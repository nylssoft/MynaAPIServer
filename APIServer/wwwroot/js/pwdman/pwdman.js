"use strict";

var pwdman = (() => {

    // UI elements

    let userPasswordPwd;
    let userNameInput;
    let codeInput;
    let oldPasswordPwd;
    let newPasswordPwd;
    let confirmPasswordPwd;
    let errorDiv;
    let emailDiv;
    let emailInput;
    let waitDiv;

    // state

    let userName;
    let userEmail;
    let confirmRegistrationCode;
    let resetPwdCode;
    let authToken;
    let requiresPass2;
    let actionChangePwd;
    let actionResetPwd;
    let actionResetPwd2;
    let actionRequestRegistration;
    let actionRegister;
    let lastErrorMessage;
    let nexturl;
    let successRegister;
    let actionOk;
    let currentUser;

    let version = "1.1.26";

    // helper

    const getState = () => {
        let ret;
        let str = window.sessionStorage.getItem("pwdman-state");
        if (str && str.length > 0) {
            ret = JSON.parse(str);
        }
        return ret;
    };

    const setState = (state) => {
        if (state) {
            window.sessionStorage.setItem("pwdman-state", JSON.stringify(state));
        }
        else {
            window.sessionStorage.removeItem("pwdman-state");
            window.localStorage.removeItem("pwdman-lltoken");
        }
    };

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    const getClientInfo = () => {
        const ci = window.localStorage.getItem("clientinfo");
        if (ci && ci.length > 0) {
            return JSON.parse(ci);
        }
        const clientInfo = { "uuid": uuid.v4(), "name": window.navigator.userAgent };
        window.localStorage.setItem("clientinfo", JSON.stringify(clientInfo));
        return clientInfo;
    }

    const authenticate = () => {
        lastErrorMessage = "";
        const clientInfo = getClientInfo();
        utils.fetch_api_call("api/pwdman/auth",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(
                    {
                        "username": userNameInput.value,
                        "password": userPasswordPwd.value,
                        "clientUUID": clientInfo.uuid,
                        "clientName": clientInfo.name
                    })
            },
            (authResult) => {
                userName = userNameInput.value;
                authToken = authResult.token;
                requiresPass2 = authResult.requiresPass2;
                if (authResult.longLivedToken) {
                    window.localStorage.setItem("pwdman-lltoken", authResult.longLivedToken);
                }
                setState({ "token": authToken, "userName": userName, "requiresPass2": requiresPass2 });
                renderPage();
            },
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        );
    };

    const authenticatePass2 = () => {
        lastErrorMessage = "";
        utils.fetch_api_call("api/pwdman/auth2",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": authToken },
                body: JSON.stringify(codeInput.value.trim())
            },
            (authResult) => {
                authToken = authResult.token;
                if (authResult.longLivedToken) {
                    window.localStorage.setItem("pwdman-lltoken", authResult.longLivedToken);
                }
                requiresPass2 = false;
                let state = getState();
                state.token = authToken;
                state.requiresPass2 = requiresPass2;
                setState(state);
                renderPage();
            },
            (errMsg) => {
                lastErrorMessage = errMsg;
                renderPage();
            },
            setWaitCursor
        );
    };

    const changePassword = () => {
        if (oldPasswordPwd.value.length == 0 || newPasswordPwd.value.length == 0) {
            errorDiv.textContent = "Es fehlen Eingabewerte.";
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = "Das best\u00E4tigte Kennwort passt nicht mit dem neuen Kennwort \u00FCberein.";
            return;
        }
        lastErrorMessage = "";
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/userpwd",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify({ "oldpassword": oldPasswordPwd.value, "newpassword": newPasswordPwd.value })
            },
            () => window.location.replace(window.location.href + "&ok"),
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        )
    };

    const requestRegistration = () => {
        lastErrorMessage = "";
        let email = emailInput.value.trim();
        if (email.length == 0 || email.indexOf("@") <= 0 ) {
            errorDiv.textContent = "Ung\u00FCltige E-Mail-Adresse.";
            return;
        }
        utils.fetch_api_call("api/pwdman/register",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(email)
            },
            (ok) => {
                if (ok) {
                    actionRequestRegistration = false;
                    actionRegister = true;
                    userEmail = email;
                }
                else {
                    lastErrorMessage = `Die E-Mail-Adresse ${email} ist noch nicht freigeschaltet.` +
                        " Du bekommst eine Antwort, sobald Deine Identit\u00E4t best\u00E4tigt wurde.";
                }
                renderPage();
            },
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        );
    };

    const register = () => {
        lastErrorMessage = "";
        if (userNameInput.value.trim().length == 0) {
            errorDiv.textContent = "Der Name fehlt.";
            return;
        }
        if (codeInput.value.trim().length == 0) {
            errorDiv.textContent = "Der Registrierungscode fehlt.";
            return;
        }
        if (newPasswordPwd.value.length == 0) {
            errorDiv.textContent = "Das Kennwort fehlt.";
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = "Die Best\u00E4tigung passt nicht mit dem Kennwort \u00FCberein.";
            return;
        }
        utils.fetch_api_call("api/pwdman/profile",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({
                    "Username": userNameInput.value.trim(),
                    "Password": newPasswordPwd.value,
                    "Email": userEmail,
                    "Token": codeInput.value.trim()
                })
            },
            () => {
                successRegister = true;
                confirmRegistrationCode = undefined;
                userName = userNameInput.value.trim();
                renderPage();
            },
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        );
    };

    const cancel = () => {
        lastErrorMessage = "";
        if (nexturl && nexturl.length > 0) {
            if (nexturl == "/diary" || nexturl == "/notes" || nexturl == "/documents" || nexturl == "/password") {
                nexturl = "/markdown";
            }
            window.location.replace(nexturl);
        }
        else {
            actionRequestRegistration = false;
            actionRegister = false;
            actionChangePwd = false;
            actionResetPwd = false;
            actionResetPwd2 = false;
            successRegister = false;
            confirmRegistrationCode = undefined;
            resetPwdCode = undefined;
            renderPage();
        }
    };

    const requestResetPassword = () => {
        let email = emailInput.value.trim();
        if (email.length == 0 || email.indexOf("@") <= 0) {
            errorDiv.textContent = "Ung\u00FCltige E-Mail-Adresse";
            return;
        }
        utils.fetch_api_call("/api/pwdman/resetpwd",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(email)
            },
            () => {
                let url = `/pwdman?resetpwd2&email=${encodeURI(email)}`;
                if (nexturl && nexturl.length > 0) {
                    url += `&nexturl=${encodeURI(nexturl)}`
                }
                window.location.href = url;
            },
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        );
    };

    const resetPassword = (parent) => {
        let email = userEmail.trim();
        let token = codeInput.value.trim();
        if (token.length == 0 || newPasswordPwd.value.length == 0 || email.length == 0) {
            errorDiv.textContent = "Es fehlen Eingabewerte.";
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = "Das best\u00E4tigte Kennwort passt nicht mit dem neuen Kennwort \u00FCberein.";
            return;
        }
        utils.fetch_api_call("/api/pwdman/resetpwd2",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({
                    "Email": email,
                    "Token": token,
                    "Password": newPasswordPwd.value
                })
            },
            () => {
                controls.removeAllChildren(parent);
                utils.create_menu(parent);
                utils.set_menu_items(currentUser);
                renderResetPwd2(parent, true);
            },
            (errMsg) => errorDiv.textContent = errMsg,
            setWaitCursor
        );
    };

    const updatePasswordStatus = (pwdid, imgpwdid, confirmpwdid, imgconfirmpwdid) => {
        errorDiv.textContent = "";
        let pwd = document.getElementById(pwdid);
        let pwdimg = document.getElementById(imgpwdid);
        let confirmpwd = document.getElementById(confirmpwdid);
        let confirmpwdimg = document.getElementById(imgconfirmpwdid);
        if (pwd && pwdimg && confirmpwd && confirmpwdimg) {
            if (pwd.value.length == 0) {
                pwdimg.style.visibility = "hidden";
                confirmpwdimg.style.visibility = "hidden";
            }
            else {
                let ok = utils.verify_password_strength(pwd.value);
                if (ok) {
                    pwdimg.src = "/images/buttons/dialog-clean.png";
                    pwdimg.title = "Kennwort ist stark genug";
                }
                else {
                    pwdimg.src = "/images/buttons/dialog-error.png";
                    pwdimg.title = "Kennwort ist nicht stark genug";
                }
                ok = pwd.value == confirmpwd.value;
                if (ok) {
                    confirmpwdimg.src = "/images/buttons/dialog-clean.png";
                    confirmpwdimg.title = "Kennwort stimmt \u00FCberein";
                }
                else {
                    confirmpwdimg.src = "/images/buttons/dialog-error.png";
                    confirmpwdimg.title = "Kennwort stimmt nicht \u00FCberein";
                }
                pwdimg.style.visibility = "visible";
                confirmpwdimg.style.visibility = "visible";
            }
        }
    };

    // rendering

    const renderHeader = (parent, title) => {
        let txt = title;
        if (currentUser) {
            txt = `${currentUser.name} - ${txt}`;
        }
        controls.create(parent, "h1", undefined, txt);
    };

    const renderError = (parent) => {
        errorDiv = controls.createDiv(parent, "error");
        if (lastErrorMessage) {
            errorDiv.textContent = lastErrorMessage;
        }
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Anmelden ${version}. Copyright 2020-2022 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
    };

    const renderUpdatePasswordStatus = (pwdDiv, pwdid, confirmPwdDiv, confirmpwdid) => {
        let imgPwd = controls.createImg(pwdDiv, "img-pwd-status", 24, 24, undefined, "Unsichtbar");
        imgPwd.id = "img-pwd-id";
        imgPwd.style.visibility = "hidden";
        let imgConfirmPwd = controls.createImg(confirmPwdDiv, "img-pwd-status", 24, 24, undefined, "Unsichtbar");
        imgConfirmPwd.id = "img-confirmpwd-id";
        imgConfirmPwd.style.visibility = "hidden";
        newPasswordPwd.addEventListener("input", () =>
            updatePasswordStatus(pwdid, imgPwd.id, confirmpwdid, imgConfirmPwd.id));
        confirmPasswordPwd.addEventListener("input", () =>
            updatePasswordStatus(pwdid, imgPwd.id, confirmpwdid, imgConfirmPwd.id));
    };

    const renderAuthentication = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Anmelden");
        controls.create(parent, "p", undefined, "Melde Dich mit Namen und Kennwort an.");
        let loginDiv = controls.createDiv(parent);
        let userNameLabel = controls.createLabel(loginDiv, undefined, "Name:");
        userNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(loginDiv, "Name", () => userPasswordPwd.focus(), undefined, 16, 32);
        userNameInput.id = "username-id";
        if (userName) {
            userNameInput.value = userName;
        }
        userNameInput.addEventListener("input", () => errorDiv.textContent = "");
        let passwordDiv = controls.createDiv(parent);
        let userPasswordLabel = controls.createLabel(passwordDiv, undefined, "Kennwort:");
        userPasswordLabel.htmlFor = "userpwd-id";
        userPasswordPwd = controls.createPasswordField(passwordDiv, "Kennwort", () => authenticate(), undefined, 16, 100);
        userPasswordPwd.id = "userpwd-id";
        if (!utils.is_mobile()) {
            if (userName) {
                userPasswordPwd.focus();
            }
            else {
                userNameInput.focus();
            }
        }
        userPasswordPwd.addEventListener("input", () => errorDiv.textContent = "");
        let buttonDiv = controls.createDiv(parent);
        controls.createButton(buttonDiv, "Anmelden", () => authenticate(), undefined, "button");
        if (nexturl) {
            controls.createButton(buttonDiv, "Abbrechen", () => cancel(), undefined, "button");
        }
        renderError(parent);
        controls.createA(controls.create(parent, "p"), "resetpwd-link", "/pwdman/resetpwd", "Kennwort vergessen?",
            () => window.location.href = `/pwdman?resetpwd&nexturl=${encodeURI(window.location.href)}`);
        let p = controls.create(parent, "p", undefined, "Du hast noch kein Konto? Hier kannst Du Dich registrieren. ");
        controls.createButton(p, "Registrieren", () => window.location.href = `/pwdman?register&nexturl=${encodeURI(window.location.href)}`);
        renderCopyright(parent);
};

    const renderPass2 = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Anmelden");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            renderError(parent);
        }
        controls.create(parent, "p", undefined, "Gib den Sicherheitsscode f\u00FCr die Zwei-Schritt-Verifizierung ein.");
        const codeDiv = controls.createDiv(parent);
        const codeLabel = controls.createLabel(codeDiv, undefined, "Sicherheitsscode:");
        codeLabel.htmlFor = "securitycode-id";
        codeInput = controls.createInputField(codeDiv, "Sicherheitsscode", () => authenticatePass2(), undefined, 10, 10);
        codeInput.id = "securitycode-id";
        if (!utils.is_mobile()) {
            codeInput.focus();
        }
        const buttonLoginDiv = controls.createDiv(parent);
        controls.createButton(buttonLoginDiv, "Anmelden", () => authenticatePass2(), undefined, "button");
        controls.createButton(buttonLoginDiv, "Abbrechen", () => {
            setState();
            cancel();
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderChangePwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Kennwort \u00E4ndern");
        if (actionOk === true) {
            controls.create(parent, "p", undefined,
                "Das Kennwort wurde erfolgreich ge\u00E4ndert! Du kannst Dich jetzt mit dem neuen Kennwort anmelden.");
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", cancel, undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, "Gib Dein altes und neues Kennwort ein." +
            " Das Kennwort muss mindestens 8 Zeichen lang sein, mindestens einen Grossbuchstaben (A-Z)," +
            " einen Kleinbuchstaben (a-z), eine Ziffer (0-9) und ein Sonderzeichen (!@$()=+-,:.) enthalten.");
        let oldPwdDiv = controls.createDiv(parent);
        let oldPwdLabel = controls.createLabel(oldPwdDiv, undefined, "Altes Kennwort:");
        oldPwdLabel.htmlFor = "oldpwd-id";
        oldPasswordPwd = controls.createPasswordField(oldPwdDiv, "Altes Kennwort", () => newPasswordPwd.focus(), undefined, 16, 100);
        oldPasswordPwd.id = "oldpwd-id";
        if (!utils.is_mobile()) {
            oldPasswordPwd.focus();
        }
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, "Neues Kennwort:");
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, "Neues Kennwort", () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, "Kennwort-Best\u00E4tigung:");
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, "Kennwort-Best\u00E4tigung", () => changePassword(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);

        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "OK", () => changePassword(), undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", cancel, undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderResetPwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Kennwort vergessen");
        controls.create(parent, "p", undefined, "Gib Deine E-Mail-Adresse ein." +
            " Du bekommst einen Sicherheitscode per E-Mail zugesendet, mit dem Du Dein Kennwort neu vergeben kannst.");
        emailDiv = controls.createDiv(parent);
        let emailLabel = controls.createLabel(emailDiv, undefined, "E-Mail-Adresse:");
        emailLabel.htmlFor = "email-id";
        emailInput = controls.createInputField(emailDiv, "E-Mail-Adresse", () => requestResetPassword(), undefined, 30, 80);
        emailInput.id = "email-id";
        emailInput.addEventListener("input", () => errorDiv.textContent = "");
        if (!utils.is_mobile()) {
            emailInput.focus();
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "Weiter", () => requestResetPassword(), undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderResetPwd2 = (parent, success) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Kennwort neu vergeben");
        if (success) {
            controls.create(parent, "p", undefined, "Die Kennwort\u00E4nderung war erfolgreich! Du kannst Dich jetzt mit dem neuen Kennwort anmelden.");
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined,
            "W\u00E4hle ein neues Kennwort." +
            ` Verwende den Sicherheitscode, welcher Dir an die E-Mail-Adresse ${userEmail} geschickt wurde.` +
            " Das neue Kennwort muss mindestens 8 Zeichen lang sein, mindestens einen Grossbuchstaben (A-Z)," +
            " einen Kleinbuchstaben (a-z), eine Ziffer (0-9) und ein Sonderzeichen (!@$()=+-,:.) enthalten.");
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, "Neues Kennwort:");
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, "Neues Kennwort", () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        if (!utils.is_mobile()) {
            newPasswordPwd.focus();
        }
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, "Kennwort-Best\u00E4tigung:");
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, "Kennwort-Best\u00E4tigung", () => codeInput.focus(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);

        let codeDiv = controls.createDiv(parent);
        let codeLabel = controls.createLabel(codeDiv, undefined, "Sicherheitscode:");
        codeLabel.htmlFor = "code-id";
        codeInput = controls.createInputField(codeDiv, "Sicherheitscode", () => resetPassword(parent), undefined, 16, 16);
        codeInput.id = "code-id";
        codeInput.addEventListener("input", () => errorDiv.textContent = "");
        if (resetPwdCode) {
            codeInput.value = resetPwdCode;
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "Kennwort \u00E4ndern", () => resetPassword(parent), undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderRequestRegistration = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Registrieren");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, "Gib Deine E-Mail-Adresse an. Wenn Sie freigeschaltet wurde, kannst Du Dich registrieren.");
        emailDiv = controls.createDiv(parent);
        let emailLabel = controls.createLabel(emailDiv, undefined, "E-Mail-Adresse:");
        emailLabel.htmlFor = "email-id";
        emailInput = controls.createInputField(emailDiv, "E-Mail-Adresse", () => requestRegistration(), undefined, 30, 80);
        emailInput.id = "email-id";
        emailInput.addEventListener("input", () => {
            errorDiv.textContent = "";
        });
        if (!utils.is_mobile()) {
            emailInput.focus();
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "Weiter", () => requestRegistration(), undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderRegister = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Registrieren");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            return;
        }
        if (successRegister) {
            controls.create(parent, "p", undefined,
                `Die Registrierung war erfolgreich! Du kannst Dich jetzt mit dem Namen ${userName} anmelden.`);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            if (userEmail) {
                let user = { "email": userEmail.trim().toLowerCase() };
                let encryptKey = utils.get_encryption_key(user);
                if (!encryptKey) {
                    utils.set_encryption_key(user, utils.generate_encryption_key(16));
                }
            }
            return;
        }
        controls.create(parent, "p", undefined,
            "W\u00E4hle einen Namen zum Anmelden und ein Kennwort." +
            ` Verwende den Registrierungscode, welcher Dir per E-Mail an ${userEmail} zugestellt wurde.` +
            " Das Kennwort muss mindestens 8 Zeichen lang sein, mindestens einen Grossbuchstaben (A-Z)," +
            " einen Kleinbuchstaben (a-z), eine Ziffer (0-9) und ein Sonderzeichen (!@$()=+-,:.) enthalten.");
        let userNameDiv = controls.createDiv(parent);
        const userNameLabel = controls.createLabel(userNameDiv, undefined, "Name:");
        userNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(userNameDiv, "Name", () => newPasswordPwd.focus(), undefined, 16, 32);
        userNameInput.id = "username-id";
        if (!utils.is_mobile()) {
            userNameInput.focus();
        }
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, "Kennwort:");
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, "Kennwort", () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, "Kennwort-Best\u00E4tigung:");
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, "Kennwort-Best\u00E4tigung", () => codeInput.focus(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);
        let codeDiv = controls.createDiv(parent);
        let codeLabel = controls.createLabel(codeDiv, undefined, "Registrierungscode:");
        codeLabel.htmlFor = "code-id";
        codeInput = controls.createInputField(codeDiv, "Registrierungscode", () => register(), undefined, 16, 16);
        codeInput.id = "code-id";
        if (confirmRegistrationCode) {
            codeInput.value = confirmRegistrationCode;
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, "Registrieren", () => register(), undefined, "button");
        controls.createButton(okCancelDiv, "Abbrechen", () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderPage = () => {
        controls.removeAllChildren(document.body);
        utils.create_menu(document.body);
        utils.create_cookies_banner(document.body);
        utils.set_menu_items(currentUser);
        let state = getState();
        if (state) {
            if (requiresPass2 == undefined) {
                requiresPass2 = state.requiresPass2;
            }
            if (!authToken || authToken.length == 0) {
                authToken = state.token;
                userName = state.userName;
            }
        }
        if (actionRequestRegistration) {
            document.title = "Registrieren";
            renderRequestRegistration(document.body);
        }
        else if (actionRegister) {
            document.title = "Registrieren";
            renderRegister(document.body);
        }
        else if (actionResetPwd) {
            document.title = "Kennwort vergessen";
            renderResetPwd(document.body);
        }
        else if (actionResetPwd2) {
            document.title = "Kennwort vergessen";
            renderResetPwd2(document.body);
        }
        else if (!authToken || authToken.length == 0) {
            document.title = "Anmelden";
            renderAuthentication(document.body);
        }
        else if (requiresPass2 == true) {
            document.title = "Anmelden";
            renderPass2(document.body);
        }
        else if (actionChangePwd) {
            document.title = "Kennwort \u00E4ndern";
            renderChangePwd(document.body);
        }
        else if (nexturl && nexturl.length > 0) {
            window.location.replace(nexturl);
        }
        else {
            window.location.replace("/markdown");
        }
    };

    const render = () => {
        if (window.location.search.length > 0) {
            let params = new URLSearchParams(window.location.search);
            actionOk = params.has("ok");
            nexturl = params.get("nexturl");
            if (params.has("username")) {
                userName = params.get("username");
            }
            if (params.has("changepwd")) {
                actionChangePwd = true;
            }
            else if (params.has("register")) {
                actionRequestRegistration = true;
                actionRegister = false;
            }
            else if (params.has("confirm") && params.has("email")) {
                confirmRegistrationCode = params.get("confirm");
                userEmail = params.get("email");
                actionRequestRegistration = false;
                actionRegister = true;
            }
            else if (params.has("resetpwd")) {
                actionResetPwd = true;
            }
            else if (params.has("resetpwd2")) {
                actionResetPwd2 = true;
                userEmail = params.get("email");
            }
            else if (params.has("resetcode") && params.has("email")) {
                actionResetPwd2 = true;
                resetPwdCode = params.get("resetcode");
                userEmail = params.get("email");                
            }
        }
        const token = utils.get_authentication_token();
        if (token && token.length > 0) {
            utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
                (user) => {
                    currentUser = user;
                    renderPage();
                },
                (errMsg) => {
                    console.error(errMsg);
                    renderPage();
                });
        }
        else {
            renderPage();
        }
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => utils.auth_lltoken(pwdman.render);
