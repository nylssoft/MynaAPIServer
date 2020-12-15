"use strict";

var usermgmt = (() => {

    // UI elements

    let waitDiv;

    // state

    let currentUser;
    let errorMessage;
    let nexturl;

    let version = "1.0.16";

    // helper

    const getLoginPerDeviceText = (ip) => {
        let txt = `${new Date(ip.lastUsedUtc).toLocaleString("de-DE")} mit Client-IP-Adresse ${ip.ipAddress}.`;
        txt += ` Insgesamt ${ip.succeeded + ip.failed} Anmeldungen`;
        if (ip.failed > 0) {
            txt += `, davon sind ${ip.failed} fehlgeschlagen`;
        }
        txt += ".";
        return txt;
    };

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    // rendering

    const renderHeader = (parent, intro, title) => {
        controls.create(parent, "h1", undefined, title ? title : "Konto");
        if (intro) {
            controls.create(parent, "p", undefined, intro);
        }
        if (currentUser) {
            let url;
            if (skatPlayerImages) {
                url = skatPlayerImages[currentUser.name.toLowerCase()];
            }
            if (!url) {
                url = "/images/skat/profiles/Player1.png";
            }
            let img = controls.createImg(parent, "img-profile", 32, 45, url);
            img.title = `Angemeldet als ${currentUser.name}`;
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna User Manager ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. `);
        controls.createA(div, "copyright", "/slideshow", "Home");
    };

    const renderConfirmRegistrations = (success, results) => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        if (success) {
            renderHeader(parent, "Ergebnisse:");
            results.reverse();
            results.forEach((r) => {
                let div = controls.createDiv(parent);
                if (r.errmsg) {
                    div.textContent = `Fehler f\u00FCr E-Mail-Adresse ${r.email}: ${r.errmsg}`;
                }
                else if (r.token) {
                    div.textContent = `Die E-Mail-Adresse ${r.email} hat den Registrierungscode ${r.token}.`;
                }
                else {
                    div.textContent = `Die Registrierung f\u00FCr die E-Mail-Adresse ${r.email} wurde abgelehnt.`;
                }
            });
            let p = controls.create(parent, "p");
            controls.createButton(p, "OK", () => render()).focus();
            renderCopyright(parent);
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call(
            "api/pwdman/confirmation",
            { headers: { "token": token } },
            (confirmations) => {
                renderHeader(parent, "Offene Registrierungsanfragen:", "Anfragen");
                let idx = 0;
                confirmations.forEach((confirmation) => {
                    let div = controls.createDiv(parent);
                    let dt = new Date(confirmation.requestedUtc).toLocaleString("de-DE");
                    controls.createCheckbox(div, `confirm-registration-${idx}`, undefined, undefined, false, () => onUpdateRegisterActions());
                    controls.create(div, "span", undefined, `E-Mail-Adresse ${confirmation.email} vom ${dt}.`);
                    idx++;
                });
                let divOptions = controls.createDiv(parent);
                divOptions.id = "register-options-id";
                controls.create(divOptions, "p", undefined, "Optionen:");
                let sendEmailDiv = controls.createDiv(divOptions);
                controls.createCheckbox(sendEmailDiv, "send-emailnotification-id", undefined, "Antwort-E-Mail verschicken");
                let errorDiv = controls.createDiv(parent, "error");
                errorDiv.id = "error-id";
                let p = controls.create(parent, "p");
                let b = controls.createButton(p, "Best\u00E4tigen", () => onConfirmRegistration(confirmations));
                b.id = "confirm-register-button-id";
                b = controls.createButton(p, "Ablehnen", () => onConfirmRegistration(confirmations, true));
                b.id = "reject-register-button-id";
                controls.createButton(p, "Zur\u00FCck", () => render());
                renderCopyright(parent);
                onUpdateRegisterActions();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const renderUserDetails = (parent, users, user) => {
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, "Benutzer");
        let nameP = controls.create(parent, "p", undefined, `Name: ${user.name}`);
        if (user.accountLocked) {
            nameP.textContent += " (gesperrt)";
        }
        controls.create(parent, "p", undefined, `E-Mail-Adresse: ${user.email}`);
        if (user.lastLoginUtc) {
            controls.create(parent, "p", undefined, `Letzte Anmeldung am ${new Date(user.lastLoginUtc).toLocaleString("de-DE")}`);
        }
        controls.create(parent, "p", undefined, `Registriert seit ${new Date(user.registeredUtc).toLocaleString("de-DE")}`);
        let rolesP = controls.create(parent, "p", undefined, "Rollen:");
        let checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-skatadmin-id", undefined, "skatadmin",
            user.roles.includes("skatadmin"),
            () => onUpdateRole(parent, users, user, "skatadmin"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-usermanager-id", undefined, "usermanager",
            user.roles.includes("usermanager"),
            () => onUpdateRole(parent, users, user, "usermanager"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-family-id", undefined, "family",
            user.roles.includes("family"),
            () => onUpdateRole(parent, users, user, "family"));
        controls.createDiv(parent, "error").id="error-id";
        let actionsDiv = controls.createDiv(parent);
        if (user.accountLocked) {
            controls.createButton(actionsDiv, "Konto entsperren", () => onUnlockUser(parent, users, user), undefined, "button");
        }
        controls.createButton(actionsDiv, "Zur\u00FCck", () => {
            controls.removeAllChildren(parent);
            renderUsersTable(parent, users);
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderUsersTable = (parent, users) => {
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Registrierte Benutzer:", "Benutzer");
        let table = controls.create(parent, "table");
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, " ");
        controls.create(tr, "th", undefined, "Name");
        controls.create(tr, "th", undefined, "Rollen");
        let tbody = controls.create(table, "tbody");
        let idx = 0;
        users.forEach(user => {
            tr = controls.create(tbody, "tr");
            let td = controls.create(tr, "td");
            controls.createCheckbox(td, `delete-user-${idx}`, undefined, undefined, false, () => onUpdateDeleteUsersActions());
            td = controls.create(tr, "td");
            let a = controls.createA(td, undefined, "#open", user.name, () => renderUserDetails(document.body, users, user));
            if (user.accountLocked) {
                a.textContent += " (gesperrt)";
            }
            td = controls.create(tr, "td", undefined, user.roles.join(", "));
            idx++;
        });
        let errorDiv = controls.createDiv(parent, "error");
        errorDiv.id = "error-id";
        controls.create(parent, "p").id = "deleteusers-actions-id";
        renderDeleteUsersActions(users);
        renderCopyright(parent);
    };

    const renderEditUsers = (success, results) => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        if (success) {
            renderHeader(parent, "Ergebnisse:");
            results.reverse();
            results.forEach((r) => {
                let div = controls.createDiv(parent);
                if (r.errmsg) {
                    div.textContent = `Fehler f\u00FCr ${r.name}: ${r.errmsg}`;
                }
                else if (r.deleted) {
                    div.textContent = `Der Benutzer ${r.name} wurde gel\u00F6scht.`;
                }
                else {
                    div.textContent = `Der Benutzer ${r.name} wurde nicht gefunden.`;
                }
            });
            let p = controls.create(parent, "p");
            controls.createButton(p, "OK", () => render()).focus();
            renderCopyright(parent);
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/users", { headers: { "token": token } },
            (users) => renderUsersTable(parent, users),
            onRejectError,
            setWaitCursor
        );
    };

    const renderDeleteUsersActions = (users, confirm) => {
        let actionsDiv = document.getElementById("deleteusers-actions-id");
        controls.removeAllChildren(actionsDiv);
        if (confirm) {
            document.getElementById("error-id").textContent = "";
            controls.create(actionsDiv, "span", "confirmation", "Willst Du die Benutzer wirklich l\u00F6schen? ");
            controls.createButton(actionsDiv, "Ja", () => onDeleteUsers(users));
            controls.createButton(actionsDiv, "Nein", () => renderDeleteUsersActions(users));
        }
        else {
            let b = controls.createButton(actionsDiv, "Konto l\u00F6schen", () => renderDeleteUsersActions(users, true));
            b.id = "delete-account-button-id";
            controls.createButton(actionsDiv, "Zur\u00FCck", () => render());
            onUpdateDeleteUsersActions();
        }
    };

    const renderCurrentUser = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent);
        let nameP = controls.create(parent, "p");
        controls.createSpan(nameP, undefined, "Name: ");
        controls.createSpan(nameP, undefined, currentUser.name);
        let emailP = controls.create(parent, "p");
        controls.createSpan(emailP, undefined, "E-Mail-Adresse: ");
        controls.createSpan(emailP, undefined, currentUser.email);
        let optionsP = controls.create(parent, "p", undefined, "Optionen:");
        let checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "account-2fa-id", undefined, "Zwei-Schritt-Verifizierung",
            currentUser.requires2FA,
            () => onUpdate2FA());
        checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "account-keeplogin-id", undefined, "Angemeldet bleiben",
            currentUser.useLongLivedToken,
            () => onUpdateKeepLogin());
        checkboxDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "account-allowresetpwd-id", undefined, "Kennwort kann zur\u00FCckgesetzt werden",
            currentUser.allowResetPassword,
            () => onUpdateAllowResetPwd());
        let lastLoginP = controls.create(parent, "p");
        let dt = new Date(currentUser.lastLoginUtc).toLocaleString("de-DE");
        controls.createSpan(lastLoginP, undefined, "Letzte Anmeldung: ");
        controls.createSpan(lastLoginP, undefined, dt);
        let registeredP = controls.create(parent, "p");
        dt = new Date(currentUser.registeredUtc).toLocaleString("de-DE");
        controls.createSpan(registeredP, undefined, "Registriert seit: ");
        controls.createSpan(registeredP, undefined, dt);
        if (currentUser.loginIpAddresses.length > 0) {
            let ipAddressesP = controls.create(parent, "p", undefined, "Anmeldungen: ");
            controls.createButton(ipAddressesP, "Aufr\u00E4umen", () => onDeleteLoginIpAddresses());
            let ul = controls.create(ipAddressesP, "ul");
            currentUser.loginIpAddresses.forEach(ip => controls.create(ul, "li", undefined, getLoginPerDeviceText(ip)));
        }
        controls.createA(parent, undefined, "/skat/results", "Skatergebnisse", () => window.open("/skat?results", "_blank"));
        controls.create(parent, "p").id = "account-actions-id";
        renderAccountActions();
        renderCopyright(parent);
    };

    const renderAccountActions = (confirm) => {
        let actionsDiv = document.getElementById("account-actions-id");
        controls.removeAllChildren(actionsDiv);
        if (confirm == "deleteaccount") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Dein Konto wirklich l\u00F6schen? ");
            controls.createButton(actionsDiv, "Ja", () => onDeleteCurrentUser());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else if (confirm == "logout") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Dich wirklich abmelden? ");
            controls.createButton(actionsDiv, "Ja", () => onLogout());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else {
            controls.createButton(actionsDiv, "Abmelden", () => renderAccountActions("logout"));
            if (nexturl) {
                controls.createButton(actionsDiv, "Zur\u00FCck", () => onOK());
            }
            let div = controls.createDiv(actionsDiv);
            controls.createButton(div, "Kennwort \u00E4ndern", () => onChangePassword());
            controls.createButton(div, "Konto l\u00F6schen", () => renderAccountActions("deleteaccount"));
            if (currentUser.roles.includes("usermanager")) {
                let adminDiv = controls.createDiv(actionsDiv);
                controls.createButton(adminDiv, "Anfragen bearbeiten", () => renderConfirmRegistrations());
                controls.createButton(adminDiv, "Benutzer bearbeiten", () => renderEditUsers());
            }
        }
    };

    const renderLogout = () => {
        currentUser = undefined;
        let parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Du bist jetzt nicht mehr angemeldet.");
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => onOK()).focus();
        renderCopyright(parent);
    }

    const renderCurrentUserDeleted = () => {
        let parent = document.body;
        utils.logout();
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Dein Konto wurde gel\u00F6scht. Du bist jetzt nicht mehr angemeldet.");
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => onOK()).focus();
        renderCopyright(parent);
    };

    const renderErrorMessage = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        renderHeader(parent, "Es ist ein Fehler aufgetreten.");
        let errorDiv = controls.createDiv(parent, "error");
        errorDiv.textContent = errorMessage;
        let p = controls.create(parent, "p");
        controls.createButton(p, "OK", () => renderCurrentUser()).focus();
        renderCopyright(parent);
    };

    // --- callbacks

    const onDoConfirm = (list, results, notification, reject) => {
        if (list.length > 0) {
            let email = list.pop();
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/confirmation",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "email": email, "notification": notification, "reject": reject })
                },
                (registerToken) => {
                    results.push({ "email": email, "token": registerToken });
                    onDoConfirm(list, results, notification, reject);
                },
                (errmsg) => {
                    results.push({ "email": email, "errmsg": errmsg });
                    onDoConfirm(list, results, notification, reject);
                },
                setWaitCursor
            );
            return;
        }
        renderConfirmRegistrations(true, results);
    };

    const onConfirmRegistration = (confirmations, reject) => {
        if (reject == undefined) {
            reject = false;
        }
        document.getElementById("error-id").textContent = "";
        let toBeConfirmed = [];
        for (let idx = 0; idx < confirmations.length; idx++) {
            let checkBox = document.getElementById(`confirm-registration-${idx}`);
            if (checkBox.checked) {
                toBeConfirmed.push(confirmations[idx].email);
            }
        }
        if (toBeConfirmed.length > 0) {
            let notification = document.getElementById("send-emailnotification-id").checked;
            let results = [];
            onDoConfirm(toBeConfirmed, results, notification, reject);
        }
        else {
            document.getElementById("error-id").textContent = "Es wurden keine Best\u00E4tigungen ausgew\u00E4hlt.";
        }
    };

    const onDoDeleteUsers = (list, results) => {
        if (list.length > 0) {
            let name = list.pop();
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user",
                {
                    method: "DELETE",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(name)
                },
                (deleted) => {
                    results.push({ "name": name, "deleted": deleted });
                    onDoDeleteUsers(list, results);
                },
                (errmsg) => {
                    results.push({ "name": name, "errmsg": errmsg });
                    onDoDeleteUsers(list, results);
                },
                setWaitCursor
            );
            return;
        }
        renderEditUsers(true, results);
    };

    const onDeleteUsers = (users) => {
        document.getElementById("error-id").textContent = "";
        let toBeDeleted = [];
        for (let idx = 0; idx < users.length; idx++) {
            let checkBox = document.getElementById(`delete-user-${idx}`);
            if (checkBox.checked) {
                toBeDeleted.push(users[idx].name);
            }
        }
        if (toBeDeleted.length > 0) {
            let results = [];
            onDoDeleteUsers(toBeDeleted, results);
        }
        else {
            document.getElementById("error-id").textContent = "Es wurden keine Benutzer ausgew\u00E4hlt.";
            renderDeleteUsersActions(users);
        }
    };

    const onUpdateDeleteUsersActions = () => {
        document.getElementById("error-id").textContent = "";
        let cntSelected = 0;
        let idx = 0;
        while (true) {
            let cb = document.getElementById(`delete-user-${idx}`);
            if (!cb) {
                break;
            }
            if (cb.checked) {
                cntSelected += 1;
            }
            idx++;
        }
        let deleteButton = document.getElementById("delete-account-button-id");
        if (deleteButton) {
            deleteButton.style.display = cntSelected == 0 ? "none" : "";
        }
    };

    const onUpdateRegisterActions = () => {
        document.getElementById("error-id").textContent = "";
        let cntSelected = 0;
        let idx = 0;
        while (true) {
            let cb = document.getElementById(`confirm-registration-${idx}`);
            if (!cb) {
                break;
            }
            if (cb.checked) {
                cntSelected += 1;
            }
            idx++;
        }
        let confirmButton = document.getElementById("confirm-register-button-id");
        let rejectButton = document.getElementById("reject-register-button-id");
        let registerOptionsDiv = document.getElementById("register-options-id");
        let s = cntSelected == 0 ? "none" : "";
        if (confirmButton && rejectButton && registerOptionsDiv) {
            confirmButton.style.display = s;
            rejectButton.style.display = s;
            registerOptionsDiv.style.display = s;
        }
    };

    const onUnlockUser = (parent, users, user) => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/user/unlock",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(user.name)
            },
            () => {
                user.accountLocked = false;
                renderUserDetails(parent, users, user);
            },
            (errMsg) => document.getElementById("error-id").textContent = errMsg,
            setWaitCursor
        );
    };

    const onOK = () => {
        if (nexturl) {
            window.location.href = nexturl;
        }
        else {
            window.location.href = "/slideshow";
        }
    };

    const onLogout = () => {
        utils.logout(renderLogout, onRejectError);
    }

    const onChangePassword = () => {
        window.location.href = "/pwdman?changepwd&nexturl=" + encodeURI(window.location.href);
    };

    const onDeleteCurrentUser = () => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/user",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(currentUser.name)
            },
            renderCurrentUserDeleted,
            onRejectError,
            setWaitCursor
        );
    };

    const onDeleteLoginIpAddresses = () => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/loginipaddress", { method: "DELETE", headers: { "token": token } },
            () => {
                currentUser.loginIpAddresses = [];
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onUpdate2FA = () => {
        let checkbox = document.getElementById("account-2fa-id");
        if (checkbox) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/2fa",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(checkbox.checked)
                },
                (changed) => {
                    if (changed) {
                        currentUser.requires2FA = checkbox.checked;
                    }
                    renderCurrentUser();
                },
                onRejectError,
                setWaitCursor
            );
        }
    };

    const onUpdateKeepLogin = () => {
        let checkbox = document.getElementById("account-keeplogin-id");
        if (checkbox) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/lltoken",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(checkbox.checked)
                },
                (changed) => {
                    if (changed) {
                        currentUser.useLongLivedToken = checkbox.checked;
                    }
                    renderCurrentUser();
                },
                onRejectError,
                setWaitCursor
            );
        }
    };

    const onUpdateAllowResetPwd = () => {
        let checkbox = document.getElementById("account-allowresetpwd-id");
        if (checkbox) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/allowresetpwd",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(checkbox.checked)
                },
                (changed) => {
                    if (changed) {
                        currentUser.allowResetPassword = checkbox.checked;
                    }
                    renderCurrentUser();
                },
                onRejectError,
                setWaitCursor
            );
        }
    };

    const onUpdateRole = (parent, users, user, role) => {
        let checkbox = document.getElementById(`roles-${role}-id`);
        if (checkbox) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/role",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "UserName": user.name, "RoleName": role, "Assigned": checkbox.checked })
                },
                (changed) => {
                    if (changed) {
                        if (checkbox.checked) {
                            user.roles.push(role);
                        }
                        else {
                            let pos = user.roles.indexOf(role);
                            user.roles.splice(pos, 1);
                        }
                    }
                    renderUserDetails(parent, users, user);
                },
                (errMsg) => {
                    document.getElementById("error-id").textContent = errMsg;
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
    };

    const onResolveCurrentUser = (user) => {
        currentUser = user;
        renderCurrentUser();
    };

    const onRejectError = (errmsg) => {
        errorMessage = errmsg;
        renderErrorMessage();
    };

    // --- start rendering

    const render = () => {
        currentUser = undefined;
        errorMessage = undefined;
        nexturl = new URLSearchParams(window.location.search).get("nexturl");
        let token = utils.get_authentication_token();
        utils.fetch_api_call(
            "api/pwdman/user",
            { headers: { "token": token } },
            onResolveCurrentUser,
            (errMsg) => {
                console.error(errMsg);
                onOK();
            },
            setWaitCursor);
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    utils.auth_lltoken(usermgmt.render);
};
