var pwdman = (() => {

    "use strict";

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

    let version = "2.0.5";

    // helper

    const getState = () => {
        let ret;
        let str = utils.get_session_storage("pwdman-state");
        if (str && str.length > 0) {
            ret = JSON.parse(str);
        }
        return ret;
    };

    const setState = (state) => {
        if (state) {
            utils.set_session_storage("pwdman-state", JSON.stringify(state));
        }
        else {
            utils.remove_session_storage("pwdman-state");
            utils.remove_local_storage("pwdman-lltoken");
        }
    };

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    const getClientInfo = () => {
        const ci = utils.get_local_storage("clientinfo");
        if (ci && ci.length > 0) {
            return JSON.parse(ci);
        }
        const clientInfo = { "uuid": window.crypto.randomUUID(), "name": window.navigator.userAgent };
        utils.set_local_storage("clientinfo", JSON.stringify(clientInfo));
        return clientInfo;
    };

    const authenticate = () => {
        lastErrorMessage = "";
        const clientInfo = getClientInfo();
        utils.fetch_api_call(`api/pwdman/auth?locale=${utils.get_locale()}`,
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
                    utils.set_local_storage("pwdman-lltoken", authResult.longLivedToken);
                }
                setState({ "token": authToken, "userName": userName, "requiresPass2": requiresPass2 });
                renderPage();
            },
            (errMsg) => errorDiv.textContent = _T(errMsg),
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
                    utils.set_local_storage("pwdman-lltoken", authResult.longLivedToken);
                }
                requiresPass2 = false;
                let state = getState();
                state.token = authToken;
                state.requiresPass2 = requiresPass2;
                setState(state);
                renderPage();
            },
            (errMsg) => {
                lastErrorMessage = _T(errMsg);
                renderPage();
            },
            setWaitCursor
        );
    };

    const changePassword = () => {
        if (oldPasswordPwd.value.length == 0 || newPasswordPwd.value.length == 0) {
            errorDiv.textContent = _T("ERROR_MISSING_INPUT");
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = _T("ERROR_MISMATCH_CONFIRM_PWD");
            return;
        }
        lastErrorMessage = "";
        const currentUrl = utils.get_window_location();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/userpwd",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify({ "oldpassword": oldPasswordPwd.value, "newpassword": newPasswordPwd.value })
            },
            () => utils.replace_window_location(currentUrl + "&ok"),
            (errMsg) => errorDiv.textContent = _T(errMsg),
            setWaitCursor
        );
    };

    const requestRegistration = () => {
        lastErrorMessage = "";
        let email = emailInput.value.trim();
        if (email.length == 0 || email.indexOf("@") <= 0 ) {
            errorDiv.textContent = _T("ERROR_INVALID_EMAIL");
            return;
        }
        utils.fetch_api_call(`api/pwdman/register?locale=${utils.get_locale()}`,
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
                    lastErrorMessage = _T("ERROR_EMAIL_NOT_VALIDATED_1", email);
                }
                renderPage();
            },
            (errMsg) => errorDiv.textContent = _T(errMsg),
            setWaitCursor
        );
    };

    const register = () => {
        lastErrorMessage = "";
        if (userNameInput.value.trim().length == 0) {
            errorDiv.textContent = _T("ERROR_MISSING_NAME");
            return;
        }
        if (codeInput.value.trim().length == 0) {
            errorDiv.textContent = _T("ERROR_MISSING_REG_CODE");
            return;
        }
        if (newPasswordPwd.value.length == 0) {
            errorDiv.textContent = _T("ERROR_MISSING_PWD");
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = _T("ERROR_MISMATCH_CONFIRM_PWD");
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
            async (user) => {
                successRegister = true;
                confirmRegistrationCode = undefined;
                userName = userNameInput.value.trim();
                await utils.set_encryption_key_async(user, utils.generate_encryption_key(16));
                renderPage();
            },
            (errMsg) => errorDiv.textContent = _T(errMsg),
            setWaitCursor
        );
    };

    const cancel = () => {
        lastErrorMessage = "";
        if (nexturl && nexturl.length > 0) {
            if (nexturl == "/diary" || nexturl == "/notes" || nexturl == "/documents" || nexturl == "/password" || nexturl == "/contacts") {
                nexturl = "/view";
            }
            utils.replace_window_location(nexturl);
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
            errorDiv.textContent = _T("ERROR_INVALID_EMAIL");
            return;
        }
        utils.fetch_api_call(`/api/pwdman/resetpwd?locale=${utils.get_locale()}`,
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(email)
            },
            () => {
                let url = `/pwdman?resetpwd2&email=${encodeURI(email)}`;
                if (nexturl && nexturl.length > 0) {
                    url += `&nexturl=${encodeURI(nexturl)}`;
                }
                utils.set_window_location(url);
            },
            (errMsg) => errorDiv.textContent = _T(errMsg),
            setWaitCursor
        );
    };

    const resetPassword = (parent) => {
        let email = userEmail.trim();
        let token = codeInput.value.trim();
        if (token.length == 0 || newPasswordPwd.value.length == 0 || email.length == 0) {
            errorDiv.textContent = _T("ERROR_MISSING_INPUT");
            return;
        }
        if (newPasswordPwd.value != confirmPasswordPwd.value) {
            errorDiv.textContent = _T("ERROR_MISMATCH_NEW_PWD");
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
            (errMsg) => errorDiv.textContent = _T(errMsg),
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
                    pwdimg.title = _T("INFO_PWD_STRONG_ENOUGH");
                }
                else {
                    pwdimg.src = "/images/buttons/dialog-error.png";
                    pwdimg.title = _T("INFO_PWD_NOT_STRONG_ENOUGH");
                }
                ok = pwd.value == confirmpwd.value;
                if (ok) {
                    confirmpwdimg.src = "/images/buttons/dialog-clean.png";
                    confirmpwdimg.title = _T("INFO_PWD_MATCH");
                }
                else {
                    confirmpwdimg.src = "/images/buttons/dialog-error.png";
                    confirmpwdimg.title = _T("INFO_PWD_NOT_MATCH");
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
        controls.create(div, "span", "copyright", `${_T("HEADER_LOGIN")} ${version}. ${_T("TEXT_COPYRIGHT")} 2020-2022 `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
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
        renderHeader(parent, _T("HEADER_LOGIN"));
        controls.create(parent, "p", undefined, _T("INFO_LOGIN"));
        let loginDiv = controls.createDiv(parent);
        let userNameLabel = controls.createLabel(loginDiv, undefined, _T("LABEL_NAME"));
        userNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(loginDiv, _T("TEXT_NAME"), () => userPasswordPwd.focus(), undefined, 16, 32);
        userNameInput.id = "username-id";
        if (userName) {
            userNameInput.value = userName;
        }
        userNameInput.addEventListener("input", () => errorDiv.textContent = "");
        let passwordDiv = controls.createDiv(parent);
        let userPasswordLabel = controls.createLabel(passwordDiv, undefined, _T("LABEL_PWD"));
        userPasswordLabel.htmlFor = "userpwd-id";
        userPasswordPwd = controls.createPasswordField(passwordDiv, _T("TEXT_PWD"), () => authenticate(), undefined, 16, 100);
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
        controls.createButton(buttonDiv, _T("BUTTON_LOGIN"), () => authenticate(), undefined, "button");
        if (nexturl) {
            controls.createButton(buttonDiv, _T("BUTTON_CANCEL"), () => cancel(), undefined, "button");
        }
        renderError(parent);
        const currentUrl = utils.get_window_location();
        controls.createA(controls.create(parent, "p"), "resetpwd-link", "/pwdman/resetpwd", _T("INFO_PWD_LOST"),
            () => utils.set_window_location(`/pwdman?resetpwd&nexturl=${encodeURI(currentUrl)}`));
        let p = controls.create(parent, "p", undefined, _T("INFO_REGISTER"));
        controls.createButton(p, _T("BUTTON_REGISTER"), () => utils.set_window_location(`/pwdman?register&nexturl=${encodeURI(currentUrl)}`));
        renderCopyright(parent);
};

    const renderPass2 = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_LOGIN"));
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            renderError(parent);
        }
        controls.create(parent, "p", undefined, _T("INFO_ENTER_SEC_KEY"));
        const codeDiv = controls.createDiv(parent);
        const codeLabel = controls.createLabel(codeDiv, undefined, _T("LABEL_SEC_KEY"));
        codeLabel.htmlFor = "securitycode-id";
        codeInput = controls.createInputField(codeDiv, _T("TEXT_SEC_KEY"), () => authenticatePass2(), undefined, 10, 10);
        codeInput.id = "securitycode-id";
        if (!utils.is_mobile()) {
            codeInput.focus();
        }
        const buttonLoginDiv = controls.createDiv(parent);
        controls.createButton(buttonLoginDiv, _T("BUTTON_LOGIN"), () => authenticatePass2(), undefined, "button");
        controls.createButton(buttonLoginDiv, _T("BUTTON_CANCEL"), () => {
            setState();
            cancel();
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderChangePwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_CHANGE_PWD"));
        if (actionOk === true) {
            controls.create(parent, "p", undefined, _T("INFO_NEW_PWD_SUCCESS"));
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, "OK", cancel, undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, `${_T("INFO_CHANGE_PWD")} ${_T("INFO_PWD_STRENGTH")}`);
        let oldPwdDiv = controls.createDiv(parent);
        let oldPwdLabel = controls.createLabel(oldPwdDiv, undefined, _T("LABEL_OLD_PWD"));
        oldPwdLabel.htmlFor = "oldpwd-id";
        oldPasswordPwd = controls.createPasswordField(oldPwdDiv, _T("TEXT_OLD_PWD"), () => newPasswordPwd.focus(), undefined, 16, 100);
        oldPasswordPwd.id = "oldpwd-id";
        if (!utils.is_mobile()) {
            oldPasswordPwd.focus();
        }
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, _T("LABEL_NEW_PWD"));
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, _T("TEXT_NEW_PWD"), () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, _T("LABEL_CONFIRM_PWD"));
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, _T("TEXT_CONFIRM_PWD"), () => changePassword(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);

        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, _T("BUTTON_OK"), () => changePassword(), undefined, "button");
        controls.createButton(okCancelDiv, _T("BUTTON_CANCEL"), cancel, undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderResetPwd = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_RESET_PWD"));
        controls.create(parent, "p", undefined, _T("INFO_RESET_PWD"));
        emailDiv = controls.createDiv(parent);
        let emailLabel = controls.createLabel(emailDiv, undefined, _T("LABEL_EMAIL_ADDRESS"));
        emailLabel.htmlFor = "email-id";
        emailInput = controls.createInputField(emailDiv, _T("TEXT_EMAIL_ADDRESS"), () => requestResetPassword(), undefined, 30, 80);
        emailInput.id = "email-id";
        emailInput.addEventListener("input", () => errorDiv.textContent = "");
        if (!utils.is_mobile()) {
            emailInput.focus();
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, _T("BUTTON_CONTINUE"), () => requestResetPassword(), undefined, "button");
        controls.createButton(okCancelDiv, _T("BUTTON_CANCEL"), () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderResetPwd2 = (parent, success) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_NEW_PWD"));
        if (success) {
            controls.create(parent, "p", undefined, _T("INFO_NEW_PWD_SUCCESS"));
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, _T("BUTTON_OK"), () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, `${_T("INFO_NEW_PWD_1", userEmail)} ${_T("INFO_PWD_STRENGTH")}`);
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, _T("LABEL_NEW_PWD"));
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, _T("TEXT_NEW_PWD"), () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        if (!utils.is_mobile()) {
            newPasswordPwd.focus();
        }
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, _T("LABEL_CONFIRM_PWD"));
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, _T("TEXT_CONFIRM_PWD"), () => codeInput.focus(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);

        let codeDiv = controls.createDiv(parent);
        let codeLabel = controls.createLabel(codeDiv, undefined, _T("LABEL_SEC_KEY"));
        codeLabel.htmlFor = "code-id";
        codeInput = controls.createInputField(codeDiv, _T("TEXT_SEC_KEY"), () => resetPassword(parent), undefined, 16, 16);
        codeInput.id = "code-id";
        codeInput.addEventListener("input", () => errorDiv.textContent = "");
        if (resetPwdCode) {
            codeInput.value = resetPwdCode;
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, _T("BUTTON_CHANGE_PWD"), () => resetPassword(parent), undefined, "button");
        controls.createButton(okCancelDiv, _T("BUTTON_CANCEL"), () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderRequestRegistration = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_REGISTER"));
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, _T("BUTTON_OK"), () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, _T("INFO_EMAIL_REGISTER"));
        emailDiv = controls.createDiv(parent);
        let emailLabel = controls.createLabel(emailDiv, undefined, _T("LABEL_EMAIL_ADDRESS"));
        emailLabel.htmlFor = "email-id";
        emailInput = controls.createInputField(emailDiv, _T("TEXT_EMAIL_ADDRESS"), () => requestRegistration(), undefined, 30, 80);
        emailInput.id = "email-id";
        emailInput.addEventListener("input", () => {
            errorDiv.textContent = "";
        });
        if (!utils.is_mobile()) {
            emailInput.focus();
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, _T("BUTTON_CONTINUE"), () => requestRegistration(), undefined, "button");
        controls.createButton(okCancelDiv, _T("BUTTON_CANCEL"), () => cancel(), undefined, "button");
        renderError(parent);
        renderCopyright(parent);
    };

    const renderRegister = (parent) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("HEADER_REGISTER"));
        if (lastErrorMessage && lastErrorMessage.length > 0) {
            controls.create(parent, "p", undefined, lastErrorMessage);
            let buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, _T("BUTTON_OK"), () => cancel(), undefined, "button");
            return;
        }
        if (successRegister) {
            controls.create(parent, "p", undefined, _T("INFO_REGISTER_SUCCESS_1", userName));
            const buttonOKDiv = controls.createDiv(parent);
            controls.createButton(buttonOKDiv, _T("BUTTON_OK"), () => cancel(), undefined, "button");
            return;
        }
        controls.create(parent, "p", undefined, `${_T("INFO_REGISTER_1", userEmail)} ${_T("INFO_PWD_STRENGTH")}`);
        let userNameDiv = controls.createDiv(parent);
        const userNameLabel = controls.createLabel(userNameDiv, undefined, _T("LABEL_NAME"));
        userNameLabel.htmlFor = "username-id";
        userNameInput = controls.createInputField(userNameDiv, _T("TEXT_NAME"), () => newPasswordPwd.focus(), undefined, 16, 32);
        userNameInput.id = "username-id";
        if (!utils.is_mobile()) {
            userNameInput.focus();
        }
        let newPwdDiv = controls.createDiv(parent);
        let newPwdLabel = controls.createLabel(newPwdDiv, undefined, _T("LABEL_PWD"));
        newPwdLabel.htmlFor = "newpwd-id";
        newPasswordPwd = controls.createPasswordField(newPwdDiv, _T("TEXT_PWD"), () => confirmPasswordPwd.focus(), undefined, 16, 100);
        newPasswordPwd.id = "newpwd-id";
        let confirmPwdDiv = controls.createDiv(parent);
        let confirmPwdLabel = controls.createLabel(confirmPwdDiv, undefined, _T("LABEL_CONFIRM_PWD"));
        confirmPwdLabel.htmlFor = "confirmpwd-id";
        confirmPasswordPwd = controls.createPasswordField(confirmPwdDiv, _T("TEXT_CONFIRM_PWD"), () => codeInput.focus(), undefined, 16, 100);
        confirmPasswordPwd.id = "confirmpwd-id";
        renderUpdatePasswordStatus(newPwdDiv, newPasswordPwd.id, confirmPwdDiv, confirmPasswordPwd.id);
        let codeDiv = controls.createDiv(parent);
        let codeLabel = controls.createLabel(codeDiv, undefined, _T("LABEL_REG_CODE"));
        codeLabel.htmlFor = "code-id";
        codeInput = controls.createInputField(codeDiv, _T("TEXT_REG_CODE"), () => register(), undefined, 16, 16);
        codeInput.id = "code-id";
        if (confirmRegistrationCode) {
            codeInput.value = confirmRegistrationCode;
        }
        let okCancelDiv = controls.createDiv(parent);
        controls.createButton(okCancelDiv, _T("BUTTON_REGISTER"), () => register(), undefined, "button");
        controls.createButton(okCancelDiv, _T("BUTTON_CANCEL"), () => cancel(), undefined, "button");
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
            document.title = _T("HEADER_REGISTER");
            renderRequestRegistration(document.body);
        }
        else if (actionRegister) {
            document.title = _T("HEADER_REGISTER");
            renderRegister(document.body);
        }
        else if (actionResetPwd) {
            document.title = _T("HEADER_RESET_PWD");
            renderResetPwd(document.body);
        }
        else if (actionResetPwd2) {
            document.title = _T("HEADER_RESET_PWD");
            renderResetPwd2(document.body);
        }
        else if (!authToken || authToken.length == 0) {
            document.title = _T("HEADER_LOGIN");
            renderAuthentication(document.body);
        }
        else if (requiresPass2 == true) {
            document.title = _T("HEADER_LOGIN");
            renderPass2(document.body);
        }
        else if (actionChangePwd) {
            document.title = _T("HEADER_CHANGE_PWD");
            renderChangePwd(document.body);
        }
        else if (nexturl && nexturl.length > 0) {
            utils.replace_window_location(nexturl);
        }
        else {
            utils.replace_window_location("/view");
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

    const init = () => {
        const urlParams = new URLSearchParams(window.location.search);
        utils.set_locale(render, urlParams.get("locale"));
    };

    // --- public API

    return {
        init: init
    };
})();

window.onload = () => utils.auth_lltoken(pwdman.init);
