"use strict";

var pwdman = (() => {

    // UI elements

    let userPasswordPwd;
    let userNameInput;
    let codeInput;
    let filterInput;
    let secretKeyPwd;
    let oldPasswordPwd;
    let newPasswordPwd;
    let confirmPasswordPwd;
    let errorDiv;
    let pwdItemsDiv;
    let emailDiv;
    let emailInput;
    let facCheckbox;
    let keepLoginCheckbox;
    let allowResetPwdCheckbox;
    let waitDiv;

    // state

    let userName;
    let userEmail;
    let confirmRegistrationCode;
    let resetPwdCode;
    let authToken;
    let requiresPass2;
    let salt
    let cryptoKey;
    let actionChangePwd;
    let actionResetPwd;
    let actionResetPwd2;
    let actionRequestRegistration;
    let actionRegister;
    let lastErrorMessage;
    let nexturl;
    let successRegister;
    let actionOk;

    let version = "1.1.16";

    // helper

    const getHostFromUrl = (urlstr) => {
        urlstr = urlstr.toLowerCase();
        if (!urlstr.startsWith("http:") && !urlstr.startsWith("https:")) {
            urlstr = `https://${urlstr}`;
        }
        return new URL(urlstr).host;
    };

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

    const reset = (errmsg) => {
        setState();
        authToken = undefined;
        cryptoKey = undefined;
        userName = undefined;
        actionChangePwd = false;
        actionResetPwd = false;
        actionResetPwd2 = false;
        actionRequestRegistration = false;
        actionRegister = false;
        lastErrorMessage = "";
        if (errmsg) {
            lastErrorMessage = errmsg;
        }
        renderPage();
    };

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    const authenticate = () => {
        lastErrorMessage = "";
        utils.fetch_api_call("api/pwdman/auth",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ "username": userNameInput.value, "password": userPasswordPwd.value })
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

    const resendTOTP = () => {
        lastErrorMessage = "";
        utils.fetch_api_call("api/pwdman/totp",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": authToken }
            },
            () => renderPage(),
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
            errorDiv.textContent = "Der Benutzername fehlt.";
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
                    "Requires2FA": facCheckbox.checked,
                    "UseLongLivedToken": keepLoginCheckbox.checked,
                    "AllowResetPassword": allowResetPwdCheckbox.checked,
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
            if (nexturl == "/diary" || nexturl == "/notes") {
                nexturl = "/slideshow";
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

    const setCryptoKey = () => {
        let encoded = new TextEncoder().encode(secretKeyPwd.value);
        crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then(key => {
                let algo = {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt: new TextEncoder().encode(salt),
                    iterations: 1000
                };
                crypto.subtle.deriveKey(algo, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then(c => {
                        cryptoKey = c;
                        renderPage();
                    })
                    .catch(err => console.error(err));
            })
            .catch(err => console.error(err));
    };

    const filterItems = (pwdItems) => {
        let v = filterInput.value.toLowerCase();
        if (v.length > 0) {
            let filteredItems = [];
            pwdItems.forEach(pwdItem => {
                if (pwdItem.Name.toLowerCase().startsWith(v)) {
                    filteredItems.push(pwdItem);
                }
            });
            renderPasswordTable(pwdItemsDiv, pwdItems, filteredItems);
        }
        else {
            renderPasswordTable(pwdItemsDiv, pwdItems);
        }
    };

    const decodePassword = async (encodedPwd) => {
        let iv = utils.hex2arr(encodedPwd.substr(0, 12 * 2));
        let data = utils.hex2arr(encodedPwd.substr(12 * 2));
        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        let cipherbuffer = new ArrayBuffer(data.length);
        let cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        let decrypted = await crypto.subtle.decrypt(options, cryptoKey, cipherbuffer);
        return new TextDecoder().decode(decrypted);
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
                    pwdimg.src = "/images/pwdman/dialog-clean.png";
                    pwdimg.title = "Kennwort ist stark genug";
                }
                else {
                    pwdimg.src = "/images/pwdman/dialog-error.png";
                    pwdimg.title = "Kennwort ist nicht stark genug";
                }
                ok = pwd.value == confirmpwd.value;
                if (ok) {
                    confirmpwdimg.src = "/images/pwdman/dialog-clean.png";
                    confirmpwdimg.title = "Kennwort stimmt \u00FCberein";
                }
                else {
                    confirmpwdimg.src = "/images/pwdman/dialog-error.png";
                    confirmpwdimg.title = "Kennwort stimmt nicht \u00FCberein";
                }
                pwdimg.style.visibility = "visible";
                confirmpwdimg.style.visibility = "visible";
            }
        }
    };

    // rendering

    const renderError = (parent) => {
        errorDiv = controls.createDiv(parent, "error");
        if (lastErrorMessage) {
            errorDiv.textContent = lastErrorMessage;
        }
    };

    const renderCopyright = (parent, title) => {
        if (!title) {
            title = "Password Manager";
        }
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna ${title} ${version}. Copyright 2020-2021 `);
        controls.createA(div, "copyright", "/homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
    };

    const renderUpdatePasswordStatus = (pwdDiv, pwdid, confirmPwdDiv, confirmpwdid) => {
        let imgPwd = controls.createImg(pwdDiv, "img-pwd-status", 24, 24);
        imgPwd.id = "img-pwd-id";
        imgPwd.style.visibility = "hidden";
        let imgConfirmPwd = controls.createImg(confirmPwdDiv, "img-pwd-status", 24, 24);
        imgConfirmPwd.id = "img-confirmpwd-id";
        imgConfirmPwd.style.visibility = "hidden";
        newPasswordPwd.addEventListener("input", () =>
            updatePasswordStatus(pwdid, imgPwd.id, confirmpwdid, imgConfirmPwd.id));
        confirmPasswordPwd.addEventListener("input", () =>
            updatePasswordStatus(pwdid, imgPwd.id, confirmpwdid, imgConfirmPwd.id));
    };

    const renderAuthentication = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Anmelden");
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
        renderCopyright(parent, "Portal");
    };

    const renderPass2 = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Anmelden");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            renderError(parent);
            let buttonResendDiv = controls.createDiv(parent);
            controls.createButton(buttonResendDiv, "Neuen Code anfordern", () => resendTOTP(), undefined, "button");
        }
        else {
            controls.create(parent, "p", undefined, "Gib den Sicherheitsscode f\u00FCr die Zwei-Schritt-Verifizierung ein. " +
                "Der Code wurde per E-Mail an Dich gesendet. " +
                "Er ist nur eine begrenzte Zeit g\u00FCltig.");
            let codeDiv = controls.createDiv(parent);
            let codeLabel = controls.createLabel(codeDiv, undefined, "Sicherheitsscode:");
            codeLabel.htmlFor = "securitycode-id";
            codeInput = controls.createInputField(codeDiv, "Sicherheitsscode", () => authenticatePass2(), undefined, 10, 10);
            codeInput.id = "securitycode-id";
            if (!utils.is_mobile()) {
                codeInput.focus();
            }
            let buttonLoginDiv = controls.createDiv(parent);
            controls.createButton(buttonLoginDiv, "Anmelden", () => authenticatePass2(), undefined, "button");
        }
        renderCopyright(parent, "Portal");
    };

    const renderChangePwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Kennwort \u00E4ndern");
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
        renderCopyright(parent, "Portal");
    };

    const renderResetPwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Kennwort vergessen");
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
        renderCopyright(parent, "Portal");
    };

    const renderResetPwd2 = (parent, success) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Kennwort neu vergeben");
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
        renderCopyright(parent, "Portal");
    };

    const renderRequestRegistration = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Registrieren");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, "Gib Deine E-Mail-Adresse an. Wenn Sie freigeschaltet wurde, kannst Du Dich mit einem Benutzernamen registrieren.");
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
        renderCopyright(parent, "Portal");
    };

    const renderRegister = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Registrieren");
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", () => cancel(), undefined, "button");
            return;
        }
        if (successRegister) {
            controls.create(parent, "p", undefined,
                `Die Registrierung war erfolgreich! Du kannst Dich jetzt mit dem Benutzernamen ${userName} anmelden.`);
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
            "W\u00E4hle Deinen Benutzernamen, ein Kennwort und" +
            " ob die Zwei-Schritt-Verifizierung aktiviert werden soll." +
            ` Verwende den Registrierungscode, welcher Dir per E-Mail an ${userEmail} zugestellt wurde.` +
            " Das Kennwort muss mindestens 8 Zeichen lang sein, mindestens einen Grossbuchstaben (A-Z)," +
            " einen Kleinbuchstaben (a-z), eine Ziffer (0-9) und ein Sonderzeichen (!@$()=+-,:.) enthalten.");
        let userNameDiv = controls.createDiv(parent);
        let nameNameLabel = controls.createLabel(userNameDiv, undefined, "Benutzername:");
        nameNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(userNameDiv, "Benutzername", () => newPasswordPwd.focus(), undefined, 16, 32);
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

        let optionsP = controls.create(parent,"p", undefined, "Optionen:");
        let checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        facCheckbox = controls.createCheckbox(checkboxDiv, undefined, undefined, "Zwei-Schritt-Verifizierung", false, undefined, false);
        checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        keepLoginCheckbox = controls.createCheckbox(checkboxDiv, undefined, undefined, "Angemeldet bleiben", true, undefined, false);
        checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        allowResetPwdCheckbox = controls.createCheckbox(checkboxDiv, undefined, undefined, "Kennwort kann zur\u00FCckgesetzt werden", true, undefined, false);
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
        renderCopyright(parent, "Portal");
    };

    const renderSecretKey = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Passw\u00F6rter dekodieren");
        controls.create(parent, "p", undefined, "Gib den Schl\u00FCssel zum Dekodieren der Passwortdatei ein.");
        let keyPwdDiv = controls.createDiv(parent);
        let keyPwdLabel = controls.createLabel(keyPwdDiv, undefined, "Schl\u00FCssel:");
        keyPwdLabel.htmlFor = "keypwd-id";
        secretKeyPwd = controls.createPasswordField(keyPwdDiv, "Schl\u00FCssel", () => setCryptoKey(), undefined, 32, 100);
        secretKeyPwd.id = "keypwd-id";
        if (!utils.is_mobile()) {
            secretKeyPwd.focus();
        }
        let buttonDecodeDiv = controls.createDiv(parent);
        controls.createButton(buttonDecodeDiv, "Dekodieren", () => setCryptoKey(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderPasswordItem = async (parent, txt, desc, decode) => {
        if (txt.length == 0) return;
        if (decode) {
            txt = await decodePassword(txt);
        }
        let showButton = controls.createImageButton(parent, `${desc} anzeigen`, undefined,
            "/images/pwdman/document-decrypt-3.png", 32, "transparent");
        controls.createImageButton(parent, `${desc} in die Zwischenablage kopieren`,
            () => {
                navigator.clipboard.writeText(txt);
            }, "/images/pwdman/edit-copy-6.png", 32, "transparent");
        let span = controls.create(parent, "span", "pwditem");
        showButton.addEventListener("click", () => {
            let hide = span.textContent.length > 0;
            if (hide) {
                span.textContent = "";
                showButton.title = `${desc} anzeigen`;
                showButton.children[0].src = "/images/pwdman/document-decrypt-3.png";
            }
            else {
                span.textContent = txt;
                showButton.title = `${desc} verbergen`;
                showButton.children[0].src = "/images/pwdman/document-encrypt-3.png";
            }
        });
    };

    const renderPasswordItemDetails = (parent, pwdItems, pwdItem) => {
        controls.removeAllChildren(parent);
        controls.create(parent, "h1", undefined, "Passwort");
        let detailsNameDiv = controls.createDiv(parent);
        controls.createLabel(detailsNameDiv, "details-label", "Name:");
        if (pwdItem.Url.length > 0) {
            let host = getHostFromUrl(pwdItem.Url);
            controls.createImg(detailsNameDiv, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
            let url = pwdItem.Url;
            if (url.indexOf(":") == -1) {
                url = `https://${url}`;
            }
            controls.createA(detailsNameDiv, undefined, url, pwdItem.Name,
                () => window.open(url, "_blank", "noopener=yes,noreferrer=yes"));
        }
        else {
            controls.create(detailsNameDiv, "span", undefined, pwdItem.Name);
        }
        if (pwdItem.Login.length) {
            let detailsLoginDiv = controls.createDiv(parent);
            controls.createLabel(detailsLoginDiv, "details-label", "Login:");
            renderPasswordItem(detailsLoginDiv, pwdItem.Login, "Login");
        }
        let detailsPasswordDiv = controls.createDiv(parent);
        controls.createLabel(detailsPasswordDiv, "details-label", "Passwort:");
        renderPasswordItem(detailsPasswordDiv, pwdItem.Password, "Passwort", true);
        if (pwdItem.Description.length > 0) {
            let detailsDescriptionDiv = controls.createDiv(parent);
            controls.createLabel(detailsDescriptionDiv, "details-label", "Beschreibung:");
            renderPasswordItem(detailsDescriptionDiv, pwdItem.Description, "Beschreibung");
        }
        let buttonBackDiv = controls.createDiv(parent);
        controls.createButton(buttonBackDiv, "Zur\u00FCck zur Liste", () => {
            controls.removeAllChildren(parent);
            renderPasswordItems(parent, pwdItems);
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderPasswordTable = (parent, pwdItems, filteredPwdItems) => {
        controls.removeAllChildren(parent);
        let table = controls.create(parent, "table");
        let tbody = controls.create(table, "tbody");
        let items = filteredPwdItems ? filteredPwdItems : pwdItems;
        items.forEach(pwdItem => {
            let tr = controls.create(tbody, "tr");
            let tdname = controls.create(tr, "td");
            if (pwdItem.Url.length > 0) {
                let host = getHostFromUrl(pwdItem.Url);
                controls.createImg(tdname, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
            }
            controls.createA(tdname, undefined, "#open", pwdItem.Name,
                () => renderPasswordItemDetails(document.body, pwdItems, pwdItem));
        });
    };

    const renderPasswordItems = (parent, pwdItems) => {
        controls.create(parent, "h1", undefined, "Passw\u00F6rter");
        controls.create(parent, "p", undefined, "Gib ein Suchbegriff ein, um die Liste zu verkleinern.");
        let filterDiv = controls.createDiv(parent);
        let searchLabel = controls.createLabel(filterDiv, undefined, "Suche:");
        searchLabel.htmlFor = "filter-id";
        filterInput = controls.createInputField(filterDiv, "Suche", undefined, undefined, 20, 32);
        filterInput.id = "filter-id";
        filterInput.addEventListener("input", () => filterItems(pwdItems));
        if (!utils.is_mobile()) {
            filterInput.focus();
        }
        pwdItemsDiv = controls.createDiv(parent);
        renderPasswordTable(pwdItemsDiv, pwdItems);
        renderCopyright(parent);
    };

    const renderPage = () => {
        controls.removeAllChildren(document.body);
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
        else if (cryptoKey === undefined) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
                (user) => {
                    salt = user.passwordManagerSalt;
                    renderSecretKey(document.body, salt);
                },
                (errmsg) => reset(errmsg));
        }
        else {
            let token = utils.get_authentication_token();
            lastErrorMessage = "";
            utils.fetch_api_call("api/pwdman/file", { headers: { "token": token } },
                (datastr) => {
                    let iv = utils.hex2arr(datastr.substr(0, 12 * 2));
                    let data = utils.hex2arr(datastr.substr(12 * 2));
                    let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
                    let cipherbuffer = new ArrayBuffer(data.length);
                    let cipherarr = new Uint8Array(cipherbuffer);
                    cipherarr.set(data);
                    crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
                        .then(decrypted => {
                            let str = new TextDecoder().decode(decrypted);
                            let pwdItems = JSON.parse(str);
                            pwdItems.sort((a, b) => a.Name.localeCompare(b.Name));
                            renderPasswordItems(document.body, pwdItems);
                        })
                        .catch(() => {
                            lastErrorMessage = "Die Passwortdatei kann nicht entschl\u00FCsselt werden.";
                            cryptoKey = undefined;
                            renderPage();
                        });
                },
                (errMsg) => {
                    lastErrorMessage = errMsg;
                    cryptoKey = undefined;
                    renderPage();
                }
            );
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
        renderPage();
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    utils.auth_lltoken(pwdman.render);
};
