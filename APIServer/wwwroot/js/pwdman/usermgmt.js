"use strict";

var usermgmt = (() => {

    // UI elements

    let waitDiv;

    // state

    let currentUser;
    let errorMessage;
    let nexturl;
    let version = "2.0.6";

    // helper

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

    const getRoleDisplayName = (name) => {
        switch (name) {
            case "usermanager":
                return _T("ROLE_ADMINISTRATOR");
            case "skatadmin":
                return _T("ROLE_SKAT");
            case "family":
                return _T("ROLE_FAMILY");
            default:
                break;
        }
        return "";
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
            controls.create(parent, "h1", "header", `${currentUser.name} - ${_T("HEADER_PROFILE")}`);
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_PROFILE")} ${version}. ${_T("TEXT_COPYRIGHT")} 2020-2022 `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderConfirmRegistrations = (success, results) => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        waitDiv = controls.createDiv(parent, "invisible-div");
        if (success) {
            renderHeader(parent, _T("LABEL_RESULTS"), _T("HEADER_REGISTRATIONS"));
            results.reverse();
            results.forEach((r) => {
                let div = controls.createDiv(parent);
                if (r.errmsg) {
                    div.textContent = _T("ERROR_CONFIRM_REG_1_2", r.email, r.errmsg);
                }
                else if (r.token) {
                    div.textContent = _T("INFO_EMAIL_REG_CODE_1_2", r.email, r.token);
                }
                else {
                    div.textContent = _T("INFO_EMAIL_REG_DENIED_1", r.email);
                }
            });
            let p = controls.create(parent, "p");
            controls.createButton(p, _T("BUTTON_OK"), () => render()).focus();
            renderCopyright(parent);
            return;
        }
        let token = utils.get_authentication_token();
        utils.fetch_api_call(
            "api/pwdman/confirmation",
            { headers: { "token": token } },
            (confirmations) => {
                renderHeader(parent, _T("LABEL_OPEN_REQUESTS"), _T("HEADER_REQUESTS"));
                let idx = 0;
                confirmations.forEach((confirmation) => {
                    let div = controls.createDiv(parent);
                    let dt = utils.format_date_string(confirmation.requestedUtc);
                    controls.createCheckbox(div, `confirm-registration-${idx}`, undefined, undefined, false, () => onUpdateRegisterActions());
                    controls.create(div, "span", undefined, _T("INFO_EMAIL_OF_DATE_1_2", confirmation.email, dt));
                    idx++;
                });
                let divOptions = controls.createDiv(parent);
                divOptions.id = "register-options-id";
                controls.create(divOptions, "p", undefined, _T("LABEL_OPTIONS"));
                let sendEmailDiv = controls.createDiv(divOptions);
                controls.createCheckbox(sendEmailDiv, "send-emailnotification-id", undefined, _T("OPTION_SEND_REPLY_EMAIL"));
                let errorDiv = controls.createDiv(parent, "error");
                errorDiv.id = "error-id";
                let p = controls.create(parent, "p");
                let b = controls.createButton(p, _T("BUTTON_CONFIRM"), () => onConfirmRegistration(confirmations));
                b.id = "confirm-register-button-id";
                b = controls.createButton(p, _T("BUTTON_REJECT"), () => onConfirmRegistration(confirmations, true));
                b.id = "reject-register-button-id";
                controls.createButton(p, _T("BUTTON_BACK"), () => render());
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
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        waitDiv = controls.createDiv(parent, "invisible-div");
        controls.create(parent, "h1", undefined, _T("HEADER_USER"));
        const namePattern = user.accountLocked ? _T("LABEL_NAME_LOCKED_1", user.name) : _T("LABEL_NAME_1", user.name);
        controls.create(parent, "p", undefined, namePattern);
        controls.create(parent, "p", undefined, _T("LABEL_EMAIL_1", user.email));
        if (user.lastLoginUtc) {
            controls.create(parent, "p", undefined, _T("INFO_LAST_LOGIN_1", utils.format_date_string(user.lastLoginUtc)));
        }
        controls.create(parent, "p", undefined, _T("INFO_REGISTERED_SINCE_1", utils.format_date_string(user.registeredUtc)));
        const documentsP = controls.create(parent, "p", undefined, _T("LABEL_QUOTA_OCCUPIED_OF_1", utils.format_size(user.usedStorage)));
        const quotaInput = controls.createInputField(documentsP, "", undefined, undefined, 4, 4);
        quotaInput.id = "quota-input-id";
        quotaInput.value = `${Math.floor(user.storageQuota / (1024 * 1024))}`;
        quotaInput.addEventListener("change", () => onUpdateStorageQuota(parent, users, user));
        controls.createSpan(documentsP, undefined, _T("INFO_MB_OCCUPIED"));
        const errorQuota = controls.createDiv(parent, "error");
        errorQuota.id = "error-quota-id";
        const loginEnabledP = controls.create(parent, "p", undefined, _T("LABEL_OPTIONS"));
        const loginEnabledDiv = controls.createDiv(loginEnabledP, "checkbox-div");
        controls.createCheckbox(loginEnabledDiv, "loginenabled-id", undefined, _T("OPTION_ALLOW_LOGIN"),
            user.loginEnabled,
            () => onUpdateLoginEnabled(parent, users, user));
        const errorLoginEnabled = controls.createDiv(parent, "error");
        errorLoginEnabled.id = "error-loginenabled-id";
        let rolesP = controls.create(parent, "p", undefined, _T("LABEL_ROLES"));
        let checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-usermanager-id", undefined, _T("ROLE_ADMINISTRATOR"),
            user.roles.includes("usermanager"),
            () => onUpdateRole(parent, users, user, "usermanager"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-family-id", undefined, _T("ROLE_FAMILY"),
            user.roles.includes("family"),
            () => onUpdateRole(parent, users, user, "family"));
        checkboxDiv = controls.createDiv(rolesP, "checkbox-div");
        controls.createCheckbox(checkboxDiv, "roles-skatadmin-id", undefined, _T("ROLE_SKAT"),
            user.roles.includes("skatadmin"),
            () => onUpdateRole(parent, users, user, "skatadmin"));
        controls.createDiv(parent, "error").id = "error-id";
        let actionsDiv = controls.createDiv(parent);
        if (user.accountLocked) {
            controls.createButton(actionsDiv, _T("BUTTON_UNLOCK_ACCOUNT"), () => onUnlockUser(parent, users, user), undefined, "button");
        }
        controls.createButton(actionsDiv, _T("BUTTON_BACK"), () => {
            controls.removeAllChildren(parent);
            utils.create_menu(parent);
            utils.set_menu_items(currentUser);
            renderUsersTable(parent, users);
        }, undefined, "button");
        renderCopyright(parent);
    };

    const renderUsersTable = (parent, users) => {
        const mobile = utils.is_mobile();
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("LABEL_REG_USERS"), _T("HEADER_USER"));
        let table = controls.create(parent, "table");
        let theader = controls.create(table, "thead");
        let tr = controls.create(theader, "tr");
        controls.create(tr, "th", undefined, " ");
        controls.create(tr, "th", undefined, _T("COLUMN_NAME"));
        if (!mobile) {
            controls.create(tr, "th", undefined, " ");
        }
        controls.create(tr, "th", undefined, _T("COLUMN_ROLES"));
        if (!mobile) {
            controls.create(tr, "th", undefined, _T("COLUMN_LAST_LOGIN"));
        }
        let tbody = controls.create(table, "tbody");
        let idx = 0;
        users.forEach(user => {
            tr = controls.create(tbody, "tr");
            let td = controls.create(tr, "td");
            controls.createCheckbox(td, `delete-user-${idx}`, undefined, undefined, false, () => onUpdateDeleteUsersActions());
            td = controls.create(tr, "td");
            const atxt = user.accountLocked ? _T("INFO_LOCKED_1", user.name) : user.name;
            controls.createA(td, undefined, "#open", atxt, () => renderUserDetails(document.body, users, user));
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
                let dt = user.lastLoginUtc ? utils.format_date_string(user.lastLoginUtc) : " ";
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
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        waitDiv = controls.createDiv(parent, "invisible-div");
        if (success) {
            renderHeader(parent, _T("LABEL_RESULTS"), _T("HEADER_USER"));
            results.reverse();
            results.forEach((r) => {
                let div = controls.createDiv(parent);
                if (r.errmsg) {
                    div.textContent = _T("ERROR_1_2", r.name, r.errmsg);
                }
                else if (r.deleted) {
                    div.textContent = _T("INFO_USER_DELETED_1", r.name);
                }
                else {
                    div.textContent = _T("INFO_USER_NOT_FOUND_1", r.name);
                }
            });
            let p = controls.create(parent, "p");
            controls.createButton(p, _T("BUTTON_OK"), () => render()).focus();
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
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_USERS"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteUsers(users));
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteUsersActions(users));
        }
        else {
            let b = controls.createButton(actionsDiv, _T("BUTTON_DELETE_ACCOUNT"), () => renderDeleteUsersActions(users, true));
            b.id = "delete-account-button-id";
            controls.createButton(actionsDiv, _T("BUTTON_BACK"), () => render());
            onUpdateDeleteUsersActions();
        }
    };

    const renderCurrentUser = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        renderHeader(parent);
        // username
        const usernameP = controls.create(parent, "p");
        controls.createSpan(usernameP, undefined, _T("LABEL_NAME") + " ");
        controls.createSpan(usernameP, undefined, currentUser.name);
        // email address
        const emailP = controls.create(parent, "p");
        controls.createSpan(emailP, undefined, _T("LABEL_EMAIL_ADDRESS") + " ");
        controls.createSpan(emailP, undefined, currentUser.email);
        // profile photo
        if (currentUser.photo) {
            const photoImg = controls.create(parent, "img", "profile-photo");
            photoImg.width = 90;
            photoImg.height = 90;
            photoImg.title = _T("INFO_PROFILE_PHOTO");
            photoImg.src = currentUser.photo;
        }
        // last login
        const lastLoginP = controls.create(parent, "p");
        const lastLoginDate = utils.format_date_string(currentUser.lastLoginUtc);
        controls.createSpan(lastLoginP, undefined, _T("LABEL_LAST_LOGIN") + " ");
        controls.createSpan(lastLoginP, undefined, lastLoginDate);
        // register date
        const registeredP = controls.create(parent, "p");
        const registerDate = utils.format_date_string(currentUser.registeredUtc);
        controls.createSpan(registeredP, undefined, _T("LABEL_REGISTERED_SINCE") + " ");
        controls.createSpan(registeredP, undefined, registerDate);
        // documents quota
        const documentsP = controls.create(parent, "p");
        controls.createSpan(documentsP, undefined, _T("LABEL_QUOTA_OCCUPIED_1_2", utils.format_size(currentUser.usedStorage), utils.format_size(currentUser.storageQuota)));
        // skat results
        controls.createA(parent, undefined, "/skat/results", _T("INFO_SKAT_RESULTS"), () => window.open("/skat?results", "_blank"));
        // actions
        controls.create(parent, "p").id = "account-actions-id";
        renderAccountActions();
        // error message
        controls.createDiv(parent, "error").id = "error-id";
        // copyright
        renderCopyright(parent);
    };

    const renderDeleteAccountActions = (confirm) => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        // wait screen
        waitDiv = controls.createDiv(parent, "invisible-div");
        // menu
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        // header
        renderHeader(parent, _T("INFO_DELETE_DATA"), _T("HEADER_DELETE_DATA"));
        const actionsDiv = parent;
        if (confirm == "deleteaccount") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_ACCOUNT"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteCurrentUser());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else if (confirm == "deletepasswordfile") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_PASSWORDS"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeletePasswordFile());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else if (confirm == "deletenotes") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_NOTES"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteNotes());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else if (confirm == "deletediary") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_DIARY"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteDiary());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else if (confirm == "deletedocuments") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_DOCUMENTS"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteDocuments());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else if (confirm == "deletecontacts") {
            controls.create(actionsDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_CONTACTS"));
            controls.createButton(actionsDiv, _T("BUTTON_YES"), () => onDeleteContacts());
            controls.createButton(actionsDiv, _T("BUTTON_NO"), () => renderDeleteAccountActions());
        }
        else {
            const div1 = controls.createDiv(actionsDiv);
            controls.createButton(div1, _T("BUTTON_DELETE_ACCOUNT"), () => renderDeleteAccountActions("deleteaccount"));
            if (currentUser.hasNotes) {
                const div2 = controls.createDiv(actionsDiv);
                controls.createButton(div2, _T("BUTTON_DELETE_NOTES"), () => renderDeleteAccountActions("deletenotes"));
            }
            if (currentUser.hasDiary) {
                const div3 = controls.createDiv(actionsDiv);
                controls.createButton(div3, _T("BUTTON_DELETE_DIARY"), () => renderDeleteAccountActions("deletediary"));
            }
            if (currentUser.hasDocuments) {
                const div4 = controls.createDiv(actionsDiv);
                controls.createButton(div4, _T("BUTTON_DELETE_DOCUMENTS"), () => renderDeleteAccountActions("deletedocuments"));
            }
            if (currentUser.hasPasswordManagerFile) {
                const div5 = controls.createDiv(actionsDiv);
                controls.createButton(div5, _T("BUTTON_DELETE_PASSWORDS"), () => renderDeleteAccountActions("deletepasswordfile"));
            }
            if (currentUser.hasContacts) {
                const div5 = controls.createDiv(actionsDiv);
                controls.createButton(div5, _T("BUTTON_DELETE_CONTACTS"), () => renderDeleteAccountActions("deletecontacts"));
            }
            const backP = controls.create(actionsDiv, "p", undefined);
            controls.createButton(backP, _T("BUTTON_BACK"), () => renderCurrentUser(), undefined, "button");
        }
        // copyright
        renderCopyright(parent);
    };

    const renderAccountActions = () => {
        const actionsDiv = document.getElementById("account-actions-id");
        controls.removeAllChildren(actionsDiv);
        const div = controls.createDiv(actionsDiv);
        controls.createButton(div, _T("BUTTON_CHANGE_PWD"), () => onChangePassword());
        controls.createButton(div, _T("BUTTON_EDIT_ACCOUNT"), () => renderEditAccount());
        controls.createButton(div, _T("BUTTON_DELETE_DATA"), () => renderDeleteAccountActions());
        if (currentUser.roles.includes("usermanager")) {
            const adminDiv = controls.createDiv(actionsDiv);
            controls.createButton(adminDiv, _T("BUTTON_EDIT_REQUESTS"), () => renderConfirmRegistrations());
            controls.createButton(adminDiv, _T("BUTTON_EDIT_USERS"), () => renderEditUsers());
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
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("INFO_LOGGED_OUT"), _T("HEADER_LOGOUT"));
        let p = controls.create(parent, "p");
        controls.createButton(p, _T("BUTTON_OK"), () => onOK()).focus();
        renderCopyright(parent);
    }

    const renderCurrentUserDeleted = () => {
        let parent = document.body;
        utils.logout();
        controls.removeAllChildren(parent);
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderHeader(parent, _T("INFO_ACCOUNT_DELETED"), _T("HEADER_LOGOUT"));
        let p = controls.create(parent, "p");
        controls.createButton(p, _T("BUTTON_OK"), () => onOK()).focus();
        renderCopyright(parent);
    };

    const renderErrorMessage = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        renderHeader(parent, _T("INFO_ERROR_OCCURED"), _T("HEADER_ERROR"));
        let errorDiv = controls.createDiv(parent, "error");
        errorDiv.textContent = _T(errorMessage);
        let p = controls.create(parent, "p");
        controls.createButton(p, _T("BUTTON_OK"), () => renderCurrentUser()).focus();
        renderCopyright(parent);
    };

    const renderEditAccount = () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        // wait screen
        waitDiv = controls.createDiv(parent, "invisible-div");
        // menu
        utils.create_menu(parent);
        utils.set_menu_items(currentUser);
        // header
        renderHeader(parent);
        // edit user name
        const usernameP = controls.create(parent, "p");
        const usernameLabel = controls.createLabel(usernameP, undefined, _T("LABEL_NAME"));
        usernameLabel.htmlFor = "username-id";
        const usernameInput = controls.createInputField(usernameP, _T("TEXT_NAME"), undefined, undefined, 16, 32);
        usernameInput.id = "username-id";
        usernameInput.value = currentUser.name;
        usernameInput.addEventListener("change", () => {
            const val = document.getElementById("username-id").value;
            if (currentUser.name != val) {
                controls.removeAllChildren(document.getElementById("section-id"));
                const usernameConfirmDiv = document.getElementById("username-confirm-id");
                controls.removeAllChildren(usernameConfirmDiv);
                controls.create(usernameConfirmDiv, "p", undefined, _T("INFO_LOGOUT_IF_NAME_CHANGED"));
                controls.create(usernameConfirmDiv, "span", "confirmation", _T("INFO_REALLY_NAME_CHANGE"));
                controls.createButton(usernameConfirmDiv, _T("BUTTON_YES"), () => onUpdateUsername());
                controls.createButton(usernameConfirmDiv, _T("BUTTON_NO"), () => renderEditAccount());
            }
        });
        controls.createDiv(usernameP).id = "username-confirm-id";
        const errorNameDiv = controls.createDiv(parent, "error");
        errorNameDiv.id = "error-username-id";
        // section will be removed if username is changed
        const section = controls.createDiv(parent);
        section.id = "section-id";
        // edit email address
        const emailAddressDiv = controls.createDiv(section);
        const emailAddressLabel = controls.createLabel(emailAddressDiv, undefined, _T("LABEL_EMAIL_ADDRESS"));
        emailAddressLabel.htmlFor = "emailaddress-id";
        const emailAddressInput = controls.createInputField(emailAddressDiv, _T("TEXT_EMAIL_ADDRESS"), undefined, undefined, 30, 80);
        emailAddressInput.id = "emailaddress-id";
        emailAddressInput.value = currentUser.email;
        emailAddressInput.addEventListener("change", onUpdateEmailAddress);
        const errorEmailDiv = controls.createDiv(section, "error");
        errorEmailDiv.id = "error-emailaddress-id";
        // edit photo
        controls.create(section, "p", undefined, _T("LABEL_PROFILE_PHOTO"));
        const photoImg = controls.create(section, "img", "profile-photo");
        photoImg.id = "profile-photo-id";
        photoImg.width = 90;
        photoImg.height = 90;
        photoImg.title = _T("INFO_PROFILE_PHOTO");
        photoImg.addEventListener("click", onSelectPhoto);
        const addImg = controls.createImg(section, "profile-photo-add", 32, 32, "/images/buttons/list-add-4.png", _T("BUTTON_ADD_PROFILE_PHOTO"));
        addImg.addEventListener("click", onSelectPhoto);
        if (currentUser.photo) {
            photoImg.src = currentUser.photo;
            const removeImg = controls.createImg(section, "profile-photo-remove", 32, 32, "/images/buttons/list-remove-4.png", _T("BUTTON_REMOVE_PROFILE_PHOTO"));
            removeImg.addEventListener("click", onDeletePhoto);
        }
        else {
            photoImg.src = "/images/buttons/user-new-3.png";
        }
        const errorPhotoDiv = controls.createDiv(section, "error");
        errorPhotoDiv.id = "error-photo-id";
        // edit options
        const optionsP = controls.create(section, "p", undefined, _T("LABEL_OPTIONS"));
        // option two factor
        const facDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(facDiv, "account-2fa-id", undefined, _T("OPTION_TWO_FACTOR"),
            currentUser.requires2FA,
            () => onUpdate2FA());
        controls.createDiv(facDiv).id = "account-2fa-div-id";
        const errorFacDiv = controls.createDiv(section, "error");
        errorFacDiv.id = "error-2fa-id";
        // option keep login
        const keepLoginDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(keepLoginDiv, "account-keeplogin-id", undefined, _T("OPTION_KEEP_LOGIN"),
            currentUser.useLongLivedToken,
            () => onUpdateKeepLogin());
        const errorKeepLoginDiv = controls.createDiv(section, "error");
        errorKeepLoginDiv.id = "error-keeplogin-id";
        // option allow reset password
        const allowResetPwdDiv = controls.createDiv(optionsP, "checkbox-div");
        controls.createCheckbox(allowResetPwdDiv, "account-allowresetpwd-id", undefined, _T("OPTION_ALLOW_RESET_PWD"),
            currentUser.allowResetPassword,
            () => onUpdateAllowResetPwd());
        const errorAllowResetDiv = controls.createDiv(section, "error");
        errorAllowResetDiv.id = "error-allowresetpwd-id";
        // back button
        const backP = controls.create(section, "p", undefined);
        controls.createButton(backP, _T("BUTTON_BACK"), () => renderCurrentUser(), undefined, "button");
        // hidden photo upload controls
        renderUploadPhoto(section);
        // copyright
        renderCopyright(parent);
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
            (errMsg) => document.getElementById("error-photo-id").textContent = _T(errMsg),
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
                    (errMsg) => document.getElementById("error-photo-id").textContent = _T(errMsg),
                    setWaitCursor
                );
            }
            else {
                document.getElementById("error-photo-id").textContent = _T("ERROR_INVALID_PROFILE_PHOTO");
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
                    results.push({ "email": email, "errmsg": _T(errmsg) });
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
            document.getElementById("error-id").textContent = _T("ERROR_NO_CONFIRMATIONS_SELECTED");
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
                    results.push({ "name": name, "errmsg": _T(errmsg) });
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
            document.getElementById("error-id").textContent = _T("ERROR_NO_USERS_SELECTED");
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
            utils.set_window_location(nexturl);
        }
        else {
            utils.set_window_location("/view");
        }
    };

    const onLogout = () => {
        utils.logout(renderLogout, onRejectError);
    }

    const onChangePassword = () => {
        const currentUrl = utils.get_window_location();
        utils.set_window_location("/pwdman?changepwd&nexturl=" + encodeURI(currentUrl));
    };

    const onDeleteContacts = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/contacts",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.hasContacts = false;
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onDeleteCurrentUser = () => {
        clearErrors();
        const token = utils.get_authentication_token();
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

    const onDeleteDiary = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/diary",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.hasDiary = false;
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onDeleteDocuments = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/documents",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.hasDocuments = false;
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onDeleteNotes = () => {
        clearErrors();
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/notes",
            {
                method: "DELETE",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
            },
            () => {
                currentUser.hasNotes = false;
                renderCurrentUser();
            },
            onRejectError,
            setWaitCursor
        );
    };

    const onDeletePasswordFile = () => {
        clearErrors();
        const token = utils.get_authentication_token();
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
                    controls.create(div, "div", "text-2fa", _T("INFO_SEC_KEY_1", secret));
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
                    controls.create(div, "div", "text-2fa", _T("INFO_INSTALL_GOOGLE_AUTH"));
                    const info = controls.create(div, "div", "text-2fa", _T("INFO_ACTIVATE_TWO_FACTOR"));
                    const input = controls.createInputField(info, _T("TEXT_SEC_KEY"), () => onEnable2FA(), "input-2fa", 10, 10);
                    input.id = "input-2fa-id";
                    controls.createButton(info, _T("BUTTON_ACTIVATE_TWO_FACTOR"), () => onEnable2FA());
                    controls.createButton(info, _T("BUTTON_NEW_SEC_KEY"), () => onUpdate2FA(true));
                    const msg = controls.createDiv(info, "error");
                    msg.id = "msg-2fa-id";
                },
                (errMsg) => {
                    document.getElementById("error-2fa-id").textContent = _T(errMsg);
                    checkbox.checked = !checkbox.checked;
                },
                setWaitCursor
            );
        }
        else if (!checkbox.checked && currentUser.requires2FA) {
            controls.create(div, "span", "confirmation", _T("INFO_REALLY_DEACTIVATE_TWO_FACTOR"));
            controls.createButton(div, _T("BUTTON_YES"), () => onDisable2FA());
            controls.createButton(div, _T("BUTTON_NO"), () => renderEditAccount());
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
                        msg.textContent = _T("INFO_SEC_KEY_INVALID");
                    }
                },
                (errMsg) => {
                    document.getElementById("error-2fa-id").textContent = _T(errMsg);
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
                document.getElementById("error-2fa-id").textContent = _T(errMsg);
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
                    document.getElementById("error-keeplogin-id").textContent = _T(errMsg);
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
                    document.getElementById("error-allowresetpwd-id").textContent = _T(errMsg);
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
                    document.getElementById("error-username-id").textContent = _T(errMsg);
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
                    document.getElementById("error-emailaddress-id").textContent = _T(errMsg);
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
                    document.getElementById("error-id").textContent = _T(errMsg);
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
                    (errMsg) => error.textContent = _T(errMsg),
                    setWaitCursor
                );
            }
            else {
                error.textContent = _T("ERROR_QUOTA_RANGE_MB_1_2", Math.max(u + 1, 2), 1000);
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
                    document.getElementById("error-loginenabled-id").textContent = _T(errMsg);
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

window.onload = () => utils.auth_lltoken(() => utils.set_locale(usermgmt.render));

window.onclick = (event) => utils.hide_menu(event);