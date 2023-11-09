var password = (() => {

    "use strict";

    // state

    let version = "2.1.0";
    let cryptoKey;
    let currentUser;
    let helpDiv;
    let filterInput;
    let pwdItemsDiv;
    let changed = false;
    let showPwd = false;

    // helper

    const hasEncryptKey = () => {
        let elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    };

    const initCryptoKey = (resolve, reject) => {
        if (!cryptoKey) {
            let elem = document.getElementById("input-encryptkey-id");
            if (elem && elem.value.trim().length > 0) {
                utils.create_crypto_key(elem.value.trim(), currentUser.passwordManagerSalt,
                    (ck) => {
                        cryptoKey = ck;
                        resolve();
                    },
                    reject
                );
                return;
            }
        }
        resolve();
    };

    const decodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    const encodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    // rendering

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - ${_T("HEADER_PASSWORDS")}`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_PASSWORDS")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderError = (errMsg) => {
        let elem = document.getElementById("error-id");
        if (elem) {
            elem.textContent = _T(errMsg);
        }
        else {
            let parent = document.body;
            controls.removeAllChildren(parent);
            renderHeader(parent, _T("INFO_ERROR_OCCURED"));
            controls.createDiv(parent, "error").textContent = _T(errMsg);
            renderCopyright(parent);
        }
    };

    const renderEncryptKeyAsync = async (parent) => {
        utils.create_menu(parent);
        renderHeader(parent);
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        let div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_PASSWORDS"));
        p = controls.create(div, "p");
        let elem = controls.createLabel(p, undefined, _T("LABEL_KEY"));
        elem.htmlFor = "input-encryptkey-id";
        elem = controls.createInputField(p, _T("TEXT_KEY"), () => onChangeEncryptKeyAsync(), undefined, 32, 32);
        elem.id = "input-encryptkey-id";
        elem.addEventListener("change", () => onChangeEncryptKeyAsync());
        if (encryptKey) {
            elem.value = encryptKey;
        }
        p = controls.create(div, "p");
        let show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            _T("OPTION_SAVE_KEY_IN_BROWSER"), !show, () => onChangeEncryptKeyAsync());
        utils.show_encrypt_key(currentUser, show);
        utils.set_menu_items(currentUser);
    };

    const renderActions = (pwdItems, pwdItem, editMode) => {
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        if (pwdItem == undefined) {
            controls.createButton(elem, _T("BUTTON_NEW_PASSWORD"), () => onNewPwdItem(pwdItems));
        }
        else if (editMode) {
            const saveButton = controls.createButton(elem, _T("BUTTON_SAVE"), () => onSavePwdItem(pwdItems, pwdItem));
            saveButton.id = "save-button-id";
            if (!changed) {
                saveButton.disabled = true;
            }
            controls.createButton(elem, _T("BUTTON_DELETE"), () => renderDeletePwdItem(pwdItems, pwdItem));
            controls.createButton(elem, _T("BUTTON_BACK"), () => renderCancelEditPwdItem(pwdItems, pwdItem));
        }
        else {
            controls.createButton(elem, _T("BUTTON_EDIT"), () => onEditPwdItem(pwdItems, pwdItem));
            controls.createButton(elem, _T("BUTTON_BACK"), () => onBackViewPwdItem(pwdItems));
        }
    };

    const renderDeletePwdItem = (pwdItems, pwdItem) => {
        const detailsDiv = document.getElementById("details-id");
        controls.hide(detailsDiv);
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        const parent = elem;
        const pConfirm = controls.create(parent, "p");
        const confirmMsg = _T("INFO_REALLY_DELETE_PWDITEM_1", pwdItem.Name);
        controls.create(pConfirm, "span", "confirmation", confirmMsg);
        controls.createButton(pConfirm, _T("BUTTON_YES"), () => onDeletePwdItem(pwdItems, pwdItem));
        controls.createButton(pConfirm, _T("BUTTON_NO"), () => onCancelDeletePwdItem(pwdItems, pwdItem));
    };

    const renderCancelEditPwdItem = (pwdItems, pwdItem) => {
        if (changed) {
            const detailsDiv = document.getElementById("details-id");
            controls.hide(detailsDiv);
            const elem = document.getElementById("action-id");
            controls.removeAllChildren(elem);
            const parent = elem;
            const pConfirm = controls.create(parent, "p");
            controls.create(pConfirm, "span", "confirmation", _T("INFO_REALLY_CANCEL_EDIT_PWDITEM_1", pwdItem.Name));
            controls.createButton(pConfirm, _T("BUTTON_YES"), () => onCancelEditPwdItem());
            controls.createButton(pConfirm, _T("BUTTON_NO"), () => onContinueEditPwdItem(pwdItems, pwdItem));
            return;
        }
        render();
    };

    const renderEditPasswordItem = (pwdItems, pwdItem, decodedPassword) => {
        const detailsDiv = document.getElementById("details-id");
        controls.removeAllChildren(detailsDiv);
        const parent = detailsDiv;
        // edit name
        const nameP = controls.create(parent, "p");
        const nameLabel = controls.createLabel(nameP, "editlabel", _T("LABEL_NAME"));
        nameLabel.htmlFor = "name-id";
        const nameInput = controls.createInputField(nameP, _T("TEXT_NAME"), undefined, "editinput", 40, 255);
        nameInput.id = "name-id";
        nameInput.value = pwdItem.Name;
        nameInput.addEventListener("input", () => onChange());
        // edit URL
        const urlP = controls.create(parent, "p");
        const urlLabel = controls.createLabel(urlP, "editlabel", _T("LABEL_URL"));
        urlLabel.htmlFor = "url-id";
        const urlInput = controls.createInputField(urlP, _T("TEXT_URL"), undefined, "editinput", 40, 255);
        urlInput.id = "url-id";
        urlInput.value = pwdItem.Url;
        urlInput.addEventListener("input", () => onChange());
        // edit username
        const usernameP = controls.create(parent, "p");
        const usernameLabel = controls.createLabel(usernameP, "editlabel", _T("LABEL_USERNAME"));
        usernameLabel.htmlFor = "username-id";
        const usernameInput = controls.createInputField(usernameP, _T("TEXT_USERNAME"), undefined, "editinput", 40, 255);
        usernameInput.id = "username-id";
        usernameInput.value = pwdItem.Login;
        usernameInput.addEventListener("input", () => onChange());
        // edit password
        const passwordP = controls.create(parent, "p");
        const passwordLabel = controls.createLabel(passwordP, "editlabel", _T("LABEL_PASSWORD"));
        passwordLabel.id = "password-label-id";
        passwordLabel.htmlFor = "password-id";
        const passwordPwd = controls.createPasswordField(passwordP, _T("TEXT_PASSWORD"), undefined, "editinput", 37, 255);
        passwordPwd.id = "password-id";
        passwordPwd.value = decodedPassword;
        passwordPwd.addEventListener("input", () => onPasswordPwdChange());
        const passwordInput = controls.createInputField(passwordP, _T("TEXT_PASSWORD"), undefined, "editinput", 37, 255);
        passwordInput.id = "password-input-id";
        passwordInput.value = decodedPassword;
        passwordInput.addEventListener("input", () => onPasswordInputChange());
        controls.hide(passwordInput);
        const showButton = controls.createImg(passwordP, "showhideimg", 22, 22, "/images/buttons/document-decrypt-3.png", _T("BUTTON_SHOW_1", _T("TEXT_PASSWORD")));
        showButton.id = "showeditpassword-button-id";
        showButton.addEventListener("click", () => onShowEditPassword());
        // edit description
        const descriptionP = controls.create(parent, "p");
        const descriptionLabel = controls.createLabel(descriptionP, "editlabel", _T("LABEL_DESCRIPTION"));
        descriptionLabel.htmlFor = "description-id";
        const descriptionInput = controls.create(descriptionP, "textarea");
        descriptionInput.id = "description-id";
        descriptionInput.value = pwdItem.Description;
        descriptionInput.rows = 4;
        descriptionInput.maxLength = 1000;
        descriptionInput.cols = 40;
        descriptionInput.addEventListener("input", () => onChange());
        renderActions(pwdItems, pwdItem, true /*editMode*/);
    };

    const renderPasswordItem = (parent, txt, desc, decode) => {
        if (txt.length == 0) return;
        if (decode) {
            decodeText(txt, (decoded) => renderPasswordItem(parent, decoded, desc), renderError);
            return;
        }
        let showButton = controls.createImageButton(parent, _T("BUTTON_SHOW_1", desc), undefined,
            "/images/buttons/document-decrypt-3.png", 32, "transparent");
        controls.createImageButton(parent, _T("BUTTON_COPY_TO_CLIPBOARD_1", desc),
            () => {
                navigator.clipboard.writeText(txt);
            }, "/images/buttons/edit-copy-6.png", 32, "transparent");
        let span = controls.create(parent, "span", "pwditem");
        showButton.addEventListener("click", () => {
            let hide = span.textContent.length > 0;
            if (hide) {
                span.textContent = "";
                showButton.title = _T("BUTTON_SHOW_1", desc);
                showButton.children[0].src = "/images/buttons/document-decrypt-3.png";
                showButton.children[0].title = showButton.title;
            }
            else {
                span.textContent = txt;
                showButton.title = _T("BUTTON_HIDE_1", desc);
                showButton.children[0].src = "/images/buttons/document-encrypt-3.png";
                showButton.children[0].title = showButton.title;
            }
        });
    };

    const renderPasswordItemDetails = (pwdItems, pwdItem) => {
        const parent = document.getElementById("details-id");
        const content = document.getElementById("content-id");
        parent.style.display = "block";
        content.style.display = "none";
        controls.removeAllChildren(parent);
        let detailsNameDiv = controls.createDiv(parent);
        controls.createLabel(detailsNameDiv, "details-label", _T("LABEL_NAME"));
        if (pwdItem.Url.length > 0) {
            let host = getHostFromUrl(pwdItem.Url);
            controls.createImg(detailsNameDiv, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`, pwdItem.Name);
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
            controls.createLabel(detailsLoginDiv, "details-label", _T("LABEL_USERNAME"));
            renderPasswordItem(detailsLoginDiv, pwdItem.Login, _T("TEXT_USERNAME"));
        }
        let detailsPasswordDiv = controls.createDiv(parent);
        controls.createLabel(detailsPasswordDiv, "details-label", _T("LABEL_PASSWORD"));
        renderPasswordItem(detailsPasswordDiv, pwdItem.Password, _T("TEXT_PASSWORD"), true);
        if (pwdItem.Description.length > 0) {
            let detailsDescriptionDiv = controls.createDiv(parent);
            controls.createLabel(detailsDescriptionDiv, "details-label", _T("LABEL_DESCRIPTION"));
            renderPasswordItem(detailsDescriptionDiv, pwdItem.Description, _T("TEXT_DESCRIPTION"));
        }
        renderActions(pwdItems, pwdItem);
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
                controls.createImg(tdname, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`, pwdItem.Name);
            }
            controls.createA(tdname, undefined, "#open", pwdItem.Name,
                () => renderPasswordItemDetails(pwdItems, pwdItem));
        });
    };

    const renderPasswordItems = (pwdItems) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        const filterDiv = controls.createDiv(parent);
        const searchLabel = controls.createLabel(filterDiv, "filterlabel", _T("LABEL_FILTER"));
        searchLabel.htmlFor = "filter-id";
        filterInput = controls.createInputField(filterDiv, _T("TEXT_FILTER"), undefined, undefined, 30, 32);
        filterInput.id = "filter-id";
        filterInput.addEventListener("input", () => onFilterItems(pwdItems));
        if (!utils.is_mobile()) {
            filterInput.focus();
        }
        pwdItemsDiv = controls.createDiv(parent);
        renderActions(pwdItems);
        if (pwdItems.length > 0) {
            renderPasswordTable(pwdItemsDiv, pwdItems);
        }
    };

    const renderPasswordFile = () => {
        renderError("");
        renderPasswordItems([]);
        if (!hasEncryptKey()) {
            renderError("ERROR_MISSING_KEY_DECODE_PASSWORD_FILE");
        }
        else if (currentUser.hasPasswordManagerFile) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call("api/pwdman/file", { headers: { "token": token } },
                (pwdfile) => {
                    decodeText(pwdfile,
                        (str) => {
                            const pwdItems = JSON.parse(str);
                            pwdItems.sort((a, b) => a.Name.localeCompare(b.Name));
                            renderPasswordItems(pwdItems);
                        },
                        (errMsg) => {
                            console.log(errMsg);
                            renderError("ERROR_WRONG_KEY_DECODE_PASSWORD_FILE");
                        });
                },
                renderError);
        }
    };

    const renderPageAsync = async (parent) => {
        await renderEncryptKeyAsync(parent);
        controls.createDiv(parent, "details").id = "details-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "error").id = "error-id";
        controls.createDiv(parent, "action").id = "action-id";
        renderCopyright(parent);
        renderPasswordFile();
    };

    const render = () => {
        parent = document.body;
        controls.removeAllChildren(parent);
        cryptoKey = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/password";
            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPageAsync(parent);
            },
            (errMsg) => console.error(errMsg));
    };

    // --- helper

    const getHostFromUrl = (urlstr) => {
        urlstr = urlstr.toLowerCase();
        if (!urlstr.startsWith("http:") && !urlstr.startsWith("https:")) {
            urlstr = `https://${urlstr}`;
        }
        return new URL(urlstr).host;
    };

    // --- callbacks

    const onNewPwdItem = (pwdItems) => {
        const parent = document.getElementById("details-id");
        const content = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        controls.show(parent, true);
        controls.hide(content);
        const randomPwd = utils.generate_encryption_key(16);
        encodeText(randomPwd, (pwdEncoded) => {
            const pwdItem = { "Name": _T("TEXT_NEW"), "Url": "", "Login": "", "Description": "", Password: pwdEncoded };
            pwdItems.push(pwdItem);
            changed = true;
            onEditPwdItem(pwdItems, pwdItem);
        });
    };

    const onEditPwdItem = (pwdItems, pwdItem) => {
        if (pwdItem.Password.length == 0) {
            renderEditPasswordItem(pwdItems, pwdItem, "");
        }
        else {
            decodeText(pwdItem.Password, (decoded) => renderEditPasswordItem(pwdItems, pwdItem, decoded), renderError);
        }
    };

    const onCancelEditPwdItem = () => {
        changed = false;
        render();
    };

    const onContinueEditPwdItem = (pwdItems, pwdItem) => {
        const detailsDiv = document.getElementById("details-id");
        controls.show(detailsDiv, true);
        renderActions(pwdItems, pwdItem, true);
    };

    const onCancelDeletePwdItem = (pwdItems, pwdItem) => {
        const detailsDiv = document.getElementById("details-id");
        controls.show(detailsDiv, true);
        renderActions(pwdItems, pwdItem, true);
    };

    const onDeletePwdItem = (pwdItems, pwdItem) => {
        const idx = pwdItems.findIndex(elem => elem === pwdItem);
        if (idx >= 0) {
            changed = false;
            pwdItems.splice(idx, 1);
            onSavePwdItems(pwdItems);
        }
    };

    const onSavePwdItem = (pwdItems, pwdItem) => {
        const nameInput = document.getElementById("name-id");
        const urlInput = document.getElementById("url-id");
        const usernameInput = document.getElementById("username-id");
        const passwordPwd = document.getElementById("password-id");
        const descriptionInput = document.getElementById("description-id");
        pwdItem.Name = nameInput.value;
        pwdItem.Url = urlInput.value;
        pwdItem.Login = usernameInput.value;
        pwdItem.Description = descriptionInput.value;
        if (passwordPwd.value.length > 0) {
            encodeText(passwordPwd.value,
                (pwdEncoded) => {
                    pwdItem.Password = pwdEncoded;
                    onSavePwdItems(pwdItems);
                },
                renderError);
        }
        else {
            onSavePwdItems(pwdItems);
        }
    };

    const onSavePwdItems = (pwdItems) => {
        pwdItems.sort((a, b) => a.Name.localeCompare(b.Name));
        const token = utils.get_authentication_token();
        const headers = { "Accept": "application/json", "Content-Type": "application/json", "token": token };
        encodeText(
            JSON.stringify(pwdItems),
            (encodedData) => 
                utils.fetch_api_call(
                    "api/pwdman/file",
                    { method: "POST", headers: headers, body: JSON.stringify(encodedData) },
                    () => onCancelEditPwdItem(),
                    renderError),
            renderError);
    };

    const onBackViewPwdItem = (pwdItems) => {
        const contentDiv = document.getElementById("content-id");
        const detailsDiv = document.getElementById("details-id");
        controls.removeAllChildren(detailsDiv);
        detailsDiv.style.display = "none";
        contentDiv.style.display = "block";
        changed = false;
        renderActions(pwdItems);
    };

    const onShowEditPassword = () => {
        const showButton = document.getElementById("showeditpassword-button-id");
        const passwordLabel = document.getElementById("password-label-id");
        const passwordInput = document.getElementById("password-input-id");
        const passwordPwd = document.getElementById("password-id");
        const desc = _T("TEXT_PASSWORD");
        if (showPwd) {
            showButton.title = _T("BUTTON_SHOW_1", desc);
            showButton.src = "/images/buttons/document-decrypt-3.png";
            controls.hide(passwordInput);
            controls.show(passwordPwd, true);
            passwordLabel.htmlFor = "password-id";
        }
        else {
            showButton.title = _T("BUTTON_HIDE_1", desc);
            showButton.src = "/images/buttons/document-encrypt-3.png";
            controls.hide(passwordPwd);
            controls.show(passwordInput, true);
            passwordLabel.htmlFor = "password-input-id";
        }
        showPwd = !showPwd;
    };

    const onPasswordPwdChange = () => {
        const passwordInput = document.getElementById("password-input-id");
        const passwordPwd = document.getElementById("password-id");
        passwordInput.value = passwordPwd.value;
        onChange();
    };

    const onPasswordInputChange = () => {
        const passwordInput = document.getElementById("password-input-id");
        const passwordPwd = document.getElementById("password-id");
        passwordPwd.value = passwordInput.value;
        onChange();
    };

    const onChange = () => {
        const saveButton = document.getElementById("save-button-id");
        if (!changed) {
            changed = true;
        }
        if (changed && saveButton.disabled == true) {
            saveButton.disabled = false;
        }
        else if (!changed && saveButton.disabled == false) {
            saveButton.disabled = true;
        }
    };

    const onFilterItems = (pwdItems) => {
        const v = filterInput.value.toLowerCase();
        if (v.length > 0) {
            const filteredItems = [];
            pwdItems.forEach(pwdItem => {
                if (pwdItem.Name.toLowerCase().includes(v)) {
                    filteredItems.push(pwdItem);
                }
            });
            renderPasswordTable(pwdItemsDiv, pwdItems, filteredItems);
        }
        else {
            renderPasswordTable(pwdItemsDiv, pwdItems);
        }
    };

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-password?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };
    
    const onChangeEncryptKeyAsync = async () => {
        let elem = document.getElementById("checkbox-save-encryptkey-id");
        let saveInBrowser = elem.checked;
        elem = document.getElementById("input-encryptkey-id");
        let val = elem.value.trim();
        if (val.length == 0 || !saveInBrowser) {
            await utils.set_encryption_key_async(currentUser);
        }
        else {
            await utils.set_encryption_key_async(currentUser, val);
        }
        cryptoKey = undefined;
        renderPasswordFile();
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => utils.auth_lltoken(() => utils.set_locale(password.render));

window.onclick = (event) => utils.hide_menu(event);