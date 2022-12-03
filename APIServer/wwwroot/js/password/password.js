"use strict";

var password = (() => {

    // state

    let version = "2.0.4";
    let cryptoKey;
    let currentUser;
    let helpDiv;
    let filterInput;
    let pwdItemsDiv;

    // helper

    const hasEncryptKey = () => {
        let elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    }

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
        controls.create(div, "span", "copyright", `${_T("HEADER_PASSWORDS")} ${version}. ${_T("TEXT_COPYRIGHT")} 2020-2022 `);
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

    const renderEncryptKey = (parent) => {
        utils.create_menu(parent);
        renderHeader(parent);
        let encryptKey = utils.get_encryption_key(currentUser);
        let div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_PASSWORDS"));
        p = controls.create(div, "p");
        let elem = controls.createLabel(p, undefined, _T("LABEL_KEY"));
        elem.htmlFor = "input-encryptkey-id";
        elem = controls.createInputField(p, _T("TEXT_KEY"), () => onChangeEncryptKey(), undefined, 32, 32);
        elem.id = "input-encryptkey-id";
        elem.addEventListener("change", () => onChangeEncryptKey());
        if (encryptKey) {
            elem.value = encryptKey;
        }
        p = controls.create(div, "p");
        let show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            _T("OPTION_SAVE_KEY_IN_BROWSER"), !show, () => onChangeEncryptKey());
        utils.show_encrypt_key(currentUser, show);
        utils.set_menu_items(currentUser);
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

    const renderPasswordItemDetails = (pwdItem) => {
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
            controls.createLabel(detailsLoginDiv, "details-label", _T("LABEL_LOGIN"));
            renderPasswordItem(detailsLoginDiv, pwdItem.Login, _T("TEXT_LOGIN"));
        }
        let detailsPasswordDiv = controls.createDiv(parent);
        controls.createLabel(detailsPasswordDiv, "details-label", _T("LABEL_PASSWORD"));
        renderPasswordItem(detailsPasswordDiv, pwdItem.Password, _T("TEXT_PASSWORD"), true);
        if (pwdItem.Description.length > 0) {
            let detailsDescriptionDiv = controls.createDiv(parent);
            controls.createLabel(detailsDescriptionDiv, "details-label", _T("LABEL_DESCRIPTION"));
            renderPasswordItem(detailsDescriptionDiv, pwdItem.Description, _T("TEXT_DESCRIPTION"));
        }
        const buttonBackDiv = controls.createDiv(parent);
        controls.createButton(buttonBackDiv, _T("BUTTON_OK"), () => {
            controls.removeAllChildren(parent);
            parent.style.display = "none";
            content.style.display = "block";
        }, undefined, "button");
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
                () => renderPasswordItemDetails(pwdItem));
        });
    };

    const renderPasswordItems = (pwdItems) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        if (pwdItems.length > 0) {
            const filterDiv = controls.createDiv(parent);
            const searchLabel = controls.createLabel(filterDiv, undefined, _T("LABEL_FILTER"));
            searchLabel.htmlFor = "filter-id";
            filterInput = controls.createInputField(filterDiv, _T("TEXT_FILTER"), undefined, undefined, 20, 32);
            filterInput.id = "filter-id";
            filterInput.addEventListener("input", () => onFilterItems(pwdItems));
            if (!utils.is_mobile()) {
                filterInput.focus();
            }
            pwdItemsDiv = controls.createDiv(parent);
            renderPasswordTable(pwdItemsDiv, pwdItems);
        }
    };

    const renderPasswordFile = () => {
        renderError("");
        renderPasswordItems([]);
        if (!currentUser.hasPasswordManagerFile) {
            renderError("ERROR_NO_PASSWORD_FILE_UPLOADED");
            showEncryptKey(true);
        }
        else if (!hasEncryptKey()) {
            renderError("ERROR_MISSING_KEY_DECODE_PASSWORD_FILE");
            showEncryptKey(true);
        }
        else {
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

    const renderPage = (parent) => {
        renderEncryptKey(parent);
        controls.createDiv(parent, "details").id = "details-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "error").id = "error-id";
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
                renderPage(parent);
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
    
    const onChangeEncryptKey = () => {
        let elem = document.getElementById("checkbox-save-encryptkey-id");
        let saveInBrowser = elem.checked;
        elem = document.getElementById("input-encryptkey-id");
        let val = elem.value.trim();
        if (val.length == 0 || !saveInBrowser) {
            utils.set_encryption_key(currentUser);
        }
        else {
            utils.set_encryption_key(currentUser, val);
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