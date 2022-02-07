"use strict";

var usermgmt = (() => {

    // UI elements

    let waitDiv;

    // state

    let currentUser;
    let errorMessage;
    let nexturl;
    let version = "1.1.22";

    const roleMapping = {
        "usermanager"   : "Administrator",
        "skatadmin"     : "Skat",
        "family"        : "Familie"
    };

    // helper

    const getLoginPerDeviceText = (ip) => {
        let txt = `${new Date(ip.lastUsedUtc).toLocaleString("de-DE")} mit IP-Adresse ${ip.ipAddress}.`;
        return txt;
    };

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    const getRoleDisplayName = (name) => {
        return roleMapping[name];
    };

    const clearErrors = () => {
        const elems = document.getElementsByClassName("error");
        Array.prototype.filter.call(elems, (elem) => {
            elem.textContent = "";
        });
    };

    // rendering

    const renderHeader = (parent, intro, title) => {
        if (title || intro || !currentUser) {
            if (title) {
                controls.create(parent, "h1", undefined, title);
            }
            if (intro) {
                controls.create(parent, "p", undefined, intro);
            }
        }
        else {
            controls.create(parent, "h1", "header", `${currentUser.name} - Profil`);
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna User Manager ${version}. Copyright 2020-2022 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
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
        if (user.usedStorageRead === undefined) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call(`api/pwdman/user/${user.id}/storage`, { headers: { "token": token } },
                (used) => {
                    user.usedStorageRead = true;
                    user.usedStorage = used;
                    renderUserDetails(parent, users, user);
                },
                onRejectError,
                setWaitCursor);
            return;
        }
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
        const documentsP = controls.create(parent, "p", undefined, `Speicherplatz f\u00FCr Dokumente: ${utils.format_size(user.usedStorage)} von `);
        const quotaInput = controls.createInputField(documentsP, "", undefined, undefined, 4, 4);
        quotaInput.id = "quota-input-id";
        quotaInput.value = `${Math.floor(user.storageQuota / (1024 * 1024))}`;
        quotaInput.addEventListener("change", () => onUpdateStorageQuota(parent, users, user));
        controls.createSpan(documentsP, undefined, " MB belegt.");
        const errorQuota = controls.createDiv(parent, "error");
        errorQuota.id = "error-quota-id";
        const loginEnabledP = controls.create(parent, "p", undefined, "Optionen:");
        const loginEnabledDiv = controls.createDiv(loginEnabledP, "checkbox-div");
        controls.createCheckbox(loginEnabledDiv, "loginenabled-id", undefined, "Anmelden erlauben",
            user.loginEnabled,
            () => onUpdateLoginEnabled(parent, users, user));
        const errorLoginEnabled = controls.createDiv(parent, "error");
        errorLoginEnabled.id = "error-loginenabled-id";
        let rolesP = controls.create(parent, "p", undefined, "Rollen:");
        let checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-usermanager-id", undefined, getRoleDisplayName("usermanager"),
            user.roles.includes("usermanager"),
            () => onUpdateRole(parent, users, user, "usermanager"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-family-id", undefined, getRoleDisplayName("family"),
            user.roles.includes("family"),
            () => onUpdateRole(parent, users, user, "family"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-skatadmin-id", undefined, getRoleDisplayName("skatadmin"),
            user.roles.includes("skatadmin"),
            () => onUpdateRole(parent, users, user, "skatadmin"));
        controls.createDiv(parent, "error").id = "error-id";
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
        const mobile = utils.is_mobile();
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, "Registrierte Benutzer:", "Benutzer");
        let table = controls.create(parent, "table");
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, " ");
        controls.create(tr, "th", undefined, "Name");
        if (!mobile) {
            controls.create(tr, "th", undefined, " ");
        }
        controls.create(tr, "th", undefined, "Rollen");
        if (!mobile) {
            controls.create(tr, "th", undefined, "Letzte Anmeldung");
        }
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
            if (!mobile) {
                td = controls.create(tr, "td", undefined, " ");
                if (user.photo) {
                    controls.createImg(td, "profile-photo-user", 45, 45, user.photo, user.name);
                }
            }
            let roleNames = [];
            user.roles.forEach((roleName) => {
                roleNames.push(getRoleDisplayName(roleName));
            });
            controls.create(tr, "td", undefined, roleNames.join(", "));
            if (!mobile) {
                let dt = user.lastLoginUtc ? new Date(user.lastLoginUtc).toLocaleString("de-DE") : " ";
                controls.create(tr, "td", undefined, dt);
            }
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
        utils.create_menu(parent);
        renderHeader(parent);
        // username
        const usernameP = controls.create(parent, "p");
        controls.createSpan(usernameP, undefined, "Name: ");
        controls.createSpan(usernameP, undefined, currentUser.name);
        // email address
        const emailP = controls.create(parent, "p");
        controls.createSpan(emailP, undefined, "E-Mail-Adresse: ");
        controls.createSpan(emailP, undefined, currentUser.email);
        // profile photo
        if (currentUser.photo) {
            const photoImg = controls.create(parent, "img", "profile-photo");
            photoImg.width = 90;
            photoImg.height = 90;
            photoImg.title = "Profilbild (90 x 90 Pixel)";
            photoImg.src = currentUser.photo;
        }
        // last login
        const lastLoginP = controls.create(parent, "p");
        const lastLoginDate = new Date(currentUser.lastLoginUtc).toLocaleString("de-DE");
        controls.createSpan(lastLoginP, undefined, "Letzte Anmeldung: ");
        controls.createSpan(lastLoginP, undefined, lastLoginDate);
        // register date
        const registeredP = controls.create(parent, "p");
        const registerDate = new Date(currentUser.registeredUtc).toLocaleString("de-DE");
        controls.createSpan(registeredP, undefined, "Registriert seit: ");
        controls.createSpan(registeredP, undefined, registerDate);
        // documents quota
        const documentsP = controls.create(parent, "p");
        controls.createSpan(documentsP, undefined, `Speicherplatz f\u00FCr Dokumente: ${utils.format_size(currentUser.usedStorage)} von ${utils.format_size(currentUser.storageQuota)} belegt.`);
        // last logins
        if (currentUser.loginIpAddresses.length > 0) {
            const loginIpP = controls.create(parent, "p");
            controls.createSpan(loginIpP, undefined, "Anmeldungen: ");
            controls.createButton(loginIpP, "Aufr\u00E4umen", () => onDeleteLoginIpAddresses());
            const ul = controls.create(loginIpP, "ul");
            currentUser.loginIpAddresses.forEach(ip => controls.create(ul, "li", undefined, getLoginPerDeviceText(ip)));
        }
        // skat results
        controls.createA(parent, undefined, "/skat/results", "Skatergebnisse", () => window.open("/skat?results", "_blank"));
        // actions
        controls.create(parent, "p").id = "account-actions-id";
        renderAccountActions();
        // error message
        controls.createDiv(parent, "error").id = "error-id";
        // copyright
        renderCopyright(parent);
        // menu items
        utils.set_menu_items(currentUser);
    };

    const renderAccountActions = (confirm) => {
        let actionsDiv = document.getElementById("account-actions-id");
        controls.removeAllChildren(actionsDiv);
        if (confirm == "deleteaccount") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Dein Konto wirklich l\u00F6schen? ");
            controls.createButton(actionsDiv, "Ja", () => onDeleteCurrentUser());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else if (confirm == "deletepasswordfile") {
            controls.create(actionsDiv, "span", "confirmation", "Willst Du Deine Passw\u00F6rter wirklich l\u00F6schen? ");
            controls.createButton(actionsDiv, "Ja", () => onDeletePasswordFile());
            controls.createButton(actionsDiv, "Nein", () => renderAccountActions());
        }
        else {
            let div = controls.createDiv(actionsDiv);
            controls.createButton(div, "Kennwort \u00E4ndern", () => onChangePassword());
            controls.createButton(div, "Konto bearbeiten", () => renderEditAccount());
            controls.createButton(div, "Konto l\u00F6schen", () => renderAccountActions("deleteaccount"));
            if (currentUser.hasPasswordManagerFile) {
                controls.createButton(div, "Passw\u00F6rter l\u00F6schen", () => renderAccountActions("deletepasswordfile"));
            }
            if (currentUser.roles.includes("usermanager")) {
                let adminDiv = controls.createDiv(actionsDiv);
                controls.createButton(adminDiv, "Anfragen bearbeiten", () => renderConfirmRegistrations());
                controls.createButton(adminDiv, "Benutzer bearbeiten", () => renderEditUsers());
            }
        }
    };

    const renderUploadPhoto = (parent) => {
        let form = controls.create(parent, "form");
        form.id = "upload-form-id";
        form.method = "post";
        form.enctype = "multipart/form-data";
        let inputFile = controls.create(form, "input");
        inputFile.type = "file";
        inputFile.name = "photo-file";
        inputFile.accept = "image/jpeg,image/png";
        inputFile.id = "file-input-id";
        inputFile.addEventListener("change", onAddPhoto);
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

    const renderEditAccount = () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        // wait screen
        waitDiv = controls.createDiv(parent, "invisible-div");
        // menu
        utils.create_menu(parent);
        // header
        renderHeader(parent);
        // edit user name
        const usernameDiv = controls.createDiv(parent);
        const usernameLabel = controls.createLabel(usernameDiv, undefined, "Name:");
        usernameLabel.htmlFor = "username-id";
        const usernameInput = controls.createInputField(usernameDiv, "Name", undefined, undefined, 16, 32);
        usernameInput.id = "username-id";
        usernameInput.value = currentUser.name;
        usernameInput.addEventListener("change", () => {
            const val = document.getElementById("username-id").value;
            if (currentUser.name != val) {
                controls.removeAllChildren(document.getElementById("section-id"));
                const usernameConfirmDiv = document.getElementById("username-confirm-id");
                controls.removeAllChildren(usernameConfirmDiv);
                controls.create(usernameConfirmDiv, "p", undefined, "Du wird abgemeldet, wenn Du Deinen Namen \u00E4nderst.");
                controls.create(usernameConfirmDiv, "span", "confirmation", "Willst Du Deinen Namen wirklich \u00E4ndern? ");
                controls.createButton(usernameConfirmDiv, "Ja", () => onUpdateUsername());
                controls.createButton(usernameConfirmDiv, "Nein", () => renderEditAccount());
            }
        });
        controls.createDiv(usernameDiv).id = "username-confirm-id";
        const errorNameDiv = controls.createDiv(parent, "error");
        errorNameDiv.id = "error-username-id";
        // section will be removed if username is changed
        const section = controls.createDiv(parent);
        section.id = "section-id";
        // edit email address
        const emailAddressDiv = controls.createDiv(section);
        const emailAddressLabel = controls.createLabel(emailAddressDiv, undefined, "E-Mail-Adresse:");
        emailAddressLabel.htmlFor = "emailaddress-id";
        const emailAddressInput = controls.createInputField(emailAddressDiv, "E-Mail-Adresse", undefined, undefined, 30, 80);
        emailAddressInput.id = "emailaddress-id";
        emailAddressInput.value = currentUser.email;
        emailAddressInput.addEventListener("change", onUpdateEmailAddress);
        const errorEmailDiv = controls.createDiv(section, "error");
        errorEmailDiv.id = "error-emailaddress-id";
        // edit photo
        controls.create(section, "p", undefined, "Profilbild:");
        const photoImg = controls.create(section, "img", "profile-photo");
        photoImg.id = "profile-photo-id";
        photoImg.width = 90;
        photoImg.height = 90;
        photoImg.title = "Profilbild (90 x 90 Pixel)";
        photoImg.addEventListener("click", onSelectPhoto);
        const addImg = controls.createImg(section, "profile-photo-add", 32, 32, "/images/buttons/list-add-4.png", "Profilbild hinzuf\u00FCgen");
        addImg.addEventListener("click", onSelectPhoto);
        if (currentUser.photo) {
            photoImg.src = currentUser.photo;
            const removeImg = controls.createImg(section, "profile-photo-remove", 32, 32, "/images/buttons/list-remove-4.png", "Profilbild entfernen");
            removeImg.addEventListener("click", onDeletePhoto);
        }
        else {
            photoImg.src = "/images/buttons/user-new-3.png";
        }
        const errorPhotoDiv = controls.createDiv(section, "error");
        errorPhotoDiv.id = "error-photo-id";
        // edit options
        const optionsP = controls.create(section, "p", undefined, "Optionen:");
        // option two factor
        const facDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(facDiv, "account-2fa-id", undefined, "Zwei-Schritt-Verifizierung",
            currentUser.requires2FA,
            () => onUpdate2FA());
        controls.createDiv(facDiv).id = "account-2fa-div-id";
        const errorFacDiv = controls.createDiv(section, "error");
        errorFacDiv.id = "error-2fa-id";
        // option keep login
        const keepLoginDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(keepLoginDiv, "account-keeplogin-id", undefined, "Angemeldet bleiben",
            currentUser.useLongLivedToken,
            () => onUpdateKeepLogin());
        const errorKeepLoginDiv = controls.createDiv(section, "error");
        errorKeepLoginDiv.id = "error-keeplogin-id";
        // option allow reset password
        const allowResetPwdDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(allowResetPwdDiv, "account-allowresetpwd-id", undefined, "Kennwort kann zur\u00FCckgesetzt werden",
            currentUser.allowResetPassword,
            () => onUpdateAllowResetPwd());
        const errorAllowResetDiv = controls.createDiv(section, "error");
        errorAllowResetDiv.id = "error-allowresetpwd-id";
        // back button
        const backP = controls.create(section, "p", undefined);
        controls.createButton(backP, "Zur\u00FCck", () => renderCurrentUser(), undefined, "button");
        // hidden photo upload controls
        renderUploadPhoto(section);
        // copyright
        renderCopyright(parent);
        // menu items
        utils.set_menu_items(currentUser);
    };

    // --- callbacks

    const onSelectPhoto = () => {
        clearErrors();
        const inputFile = document.getElementById("file-input-id");
        if (inputFile) {
            inputFile.click();
        }
    };

    const onDeletePhoto = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/photo",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.photo = undefined;
                renderEditAccount();
            },
            (errMsg) => document.getElementById("error-photo-id").textContent = errMsg,
            setWaitCursor
        );
    };

    const onAddPhoto = () => {
        clearErrors();
        const inputFile = document.getElementById("file-input-id");
        if (inputFile && inputFile.files.length == 1) {
            const curFile = inputFile.files[0];
            const mimeTypes = ["image/jpeg", "image/png"];
            if (mimeTypes.includes(curFile.type) && curFile.size < 10 * 1024 * 1024) {
                const formData = new FormData(document.getElementById("upload-form-id"));
                const token = utils.get_authentication_token();
                utils.fetch_api_call("api/pwdman/photo",
                    {
                        method: "POST",
                        headers: { "token": token },
                        body: formData
                    },
                    (photo) => {
                        currentUser.photo = photo;
                        renderEditAccount();
                    },
                    (errMsg) => document.getElementById("error-photo-id").textContent = errMsg,
                    setWaitCursor
                );
            }
            else {
                document.getElementById("error-photo-id").textContent = "Ung\u00FCltige Datei. Erlaubt sind JPG und PNG bis 10 MB.";
            }
        }
    };

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
        clearErrors();
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
        clearErrors();
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
        clearErrors();
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
        clearErrors();
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
        clearErrors();
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
            window.location.href = "/markdown";
        }
    };

    const onLogout = () => {
        utils.logout(renderLogout, onRejectError);
    }

    const onChangePassword = () => {
        window.location.href = "/pwdman?changepwd&nexturl=" + encodeURI(window.location.href);
    };

    const onDeleteCurrentUser = () => {
        clearErrors();
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

    const onDeletePasswordFile = () => {
        clearErrors();
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/file",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.hasPasswordManagerFile = false;
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onDeleteLoginIpAddresses = () => {
        clearErrors();
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

    const onUpdate2FA = (forceNew) => {
        clearErrors();
        const checkbox = document.getElementById("account-2fa-id");
        const div = document.getElementById("account-2fa-div-id");
        controls.removeAllChildren(div);
        let token = utils.get_authentication_token();
        if (checkbox.checked && !currentUser.requires2FA) {
            utils.fetch_api_call("api/pwdman/user/2fa",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(forceNew === true)
                },
                (m) => {
                    const secret = m.secretKey;
                    const issuer = m.issuer;
                    controls.create(div, "div", "text-2fa", `Sicherheitsschl\u00FCssel: ${secret}`);
                    const qrDiv = controls.createDiv(div, "text-2fa");
                    const url = `otpauth://totp/${issuer}:${currentUser.email}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
                    new QRCode(qrDiv, {
                        text: url,
                        width: 128,
                        height: 128,
                        colorDark: "#ffffff",
                        colorLight: "#000000",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    controls.create(div, "div", "text-2fa",
                        "Installiere die App Google Authenticator auf Deinem Smartphone " +
                        "und scanne den QR-Code oder gibt den Sicherheitsschl\u00FCssel ein.");
                    const info = controls.create(div, "div", "text-2fa", "Aktiviere die Zweit-Schritt-Verifizierung, indem Du den Sicherheitscode aus der App eingibst.");
                    const input = controls.createInputField(info, "Sicherheitscode", () => onEnable2FA(), "input-2fa", 10, 10);
                    input.id = "input-2fa-id";
                    controls.createButton(info, "Jetzt aktivieren!", () => onEnable2FA());
                    controls.createButton(info, "Neuer Schl\u00FCssel", () => onUpdate2FA(true));
                    const msg = controls.createDiv(info, "error");
                    msg.id = "msg-2fa-id";
                },
                (errMsg) => {
                    document.getElementById("error-2fa-id").textContent = errMsg;
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
        else if (!checkbox.checked && currentUser.requires2FA) {
            controls.create(div, "span", "confirmation", "Willst Du die Zwei-Schritt-Verifizierung wirklich deaktivieren? ");
            controls.createButton(div, "Ja", () => onDisable2FA());
            controls.createButton(div, "Nein", () => renderEditAccount());
        }
        else {
            renderEditAccount();
        }
    };

    const onEnable2FA = () => {
        clearErrors();
        const msg = document.getElementById("msg-2fa-id");
        msg.textContent = "";
        const input = document.getElementById("input-2fa-id");
        const totp = input.value.trim();
        if (totp.length > 0) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/2fa",
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(totp)
                },
                (changed) => {
                    if (changed) {
                        currentUser.requires2FA = true;
                        renderEditAccount();
                    }
                    else {
                        msg.textContent = "Der Code ist ung\u00FCltig.";
                    }
                },
                (errMsg) => {
                    document.getElementById("error-2fa-id").textContent = errMsg;
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
    };

    const onDisable2FA = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/user/2fa",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            (changed) => {
                if (changed) {
                    currentUser.requires2FA = false;
                }
                renderEditAccount();
            },
            (errMsg) => {
                document.getElementById("error-2fa-id").textContent = errMsg;
                checkbox.checked = !checkbox.checked;
            },
            setWaitCursor
        );
    };

    const onUpdateKeepLogin = () => {
        clearErrors();
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
                    renderEditAccount();
                },
                (errMsg) => {
                    document.getElementById("error-keeplogin-id").textContent = errMsg;
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
    };

    const onUpdateAllowResetPwd = () => {
        clearErrors();
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
                    renderEditAccount();
                },
                (errMsg) => {
                    document.getElementById("error-allowresetpwd-id").textContent = errMsg;
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
    };

    const onUpdateUsername = () => {
        clearErrors();
        const usernameInput = document.getElementById("username-id");
        const newUsername = usernameInput.value.trim();
        if (usernameInput && newUsername.length > 0 && newUsername != currentUser.name) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/name",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(newUsername)
                },
                (changed) => {
                    if (changed) {
                        utils.logout(renderLogout, onRejectError);
                    }
                    else {
                        renderEditAccount();
                    }
                },
                (errMsg) => {
                    document.getElementById("error-username-id").textContent = errMsg;
                },
                setWaitCursor
            );
        }
    };

    const onUpdateEmailAddress = () => {
        clearErrors();
        const emailInput = document.getElementById("emailaddress-id");
        if (emailInput && emailInput.value.trim().length > 0) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/email",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(emailInput.value.trim())
                },
                (changed) => {
                    if (changed) {
                        currentUser.email = emailInput.value.trim();
                    }
                    renderEditAccount();
                },
                (errMsg) => {
                    document.getElementById("error-emailaddress-id").textContent = errMsg;
                },
                setWaitCursor
            );
        }
    };

    const onUpdateRole = (parent, users, user, role) => {
        clearErrors();
        let checkbox = document.getElementById(`roles-${role}-id`);
        if (checkbox) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/user/role",
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "Username": user.name, "RoleName": role, "Assigned": checkbox.checked })
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

    const onUpdateStorageQuota = (parent, users, user) => {
        clearErrors();
        const u = Math.floor(user.usedStorage / (1024 * 1024));
        const quota = document.getElementById("quota-input-id");
        const v = quota.value.trim();
        if (v.length > 0) {
            const error = document.getElementById("error-quota-id");
            let val = parseInt(v);
            if (!isNaN(val) && val > Math.max(u, 1) && val <= 1000) {
                val *= 1024 * 1024;
                error.textContent = "";
                let token = utils.get_authentication_token();
                utils.fetch_api_call(`api/pwdman/user/${user.id}/storage`,
                    {
                        method: "PUT",
                        headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                        body: val
                    },
                    (changed) => {
                        if (changed) {
                            user.storageQuota = val;
                            renderUserDetails(parent, users, user);
                        }
                    },
                    (errMsg) => error.textContent = errMsg,
                    setWaitCursor
                );
            }
            else {
                error.textContent = `Die Quota muss zwischen ${Math.max(u + 1, 2)} MB und 1000 MB liegen.`;
            }
        }
    };

    const onUpdateLoginEnabled = (parent, users, user) => {
        clearErrors();
        const checkbox = document.getElementById("loginenabled-id");
        if (checkbox) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call(`api/pwdman/user/${user.id}/loginenabled`,
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(checkbox.checked)
                },
                (changed) => {
                    if (changed) {
                        user.loginEnabled = checkbox.checked;
                        renderUserDetails(parent, users, user);
                    }
                },
                (errMsg) => {
                    document.getElementById("error-loginenabled-id").textContent = errMsg;
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
        let urlParams = new URLSearchParams(window.location.search);
        nexturl = urlParams.get("nexturl");
        if (urlParams.has("logout")) {
            onLogout();
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call(
            "api/pwdman/user?details=true",
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

window.onload = () => utils.auth_lltoken(usermgmt.render);

window.onclick = (event) => utils.hide_menu(event);