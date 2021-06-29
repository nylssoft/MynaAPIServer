"use strict";

var password = (() => {

    // state

    let version = "1.0.1";
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

    const showEncryptKey = (show) => {
        let encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!encryptKeyElem) return;
        if (show || !utils.has_viewed_encryption_key(currentUser)) {
            encryptKeyElem.classList.add("show");
        }
        else {
            encryptKeyElem.classList.remove("show");
        }
        renderDropdownContent();
    };

    // rendering

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        let dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        let parent = document.getElementById("dropdown-id");
        let encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!parent || !encryptKeyElem) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/markdown?page=welcome", "Willkommen");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/documents", "Dokumente");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/password", "Passw\u00F6rter");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/skat", "Skat");
        controls.createA(parent, undefined, "/tetris", "Tetris");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/usermgmt", "Profil");
        controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        if (encryptKeyElem.classList.contains("show")) {
            controls.createA(parent, undefined, "/hidekey", "Schl\u00FCssel verbergen",
                () => {
                    utils.set_viewed_encryption_key(currentUser, true);
                    showEncryptKey(false);
                });
        }
        else {
            controls.createA(parent, undefined, "/showkey", "Schl\u00FCssel anzeigen",
                () => showEncryptKey(true));
        }
    };

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - Passw\u00F6rter`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png");
        helpImg.title = "Hilfe";
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Password ${version}. Copyright 2020-2021 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
    };

    const renderError = (errMsg) => {
        let elem = document.getElementById("error-id");
        if (elem) {
            elem.textContent = errMsg;
        }
        else {
            let parent = document.body;
            controls.removeAllChildren(parent);
            renderHeader(parent, "Es ist ein Fehler aufgetreten.");
            controls.createDiv(parent, "error").textContent = errMsg;
            renderCopyright(parent);
        }
    };

    const renderEncryptKey = (parent) => {
        renderDropdown(parent);
        renderHeader(parent);
        let encryptKey = utils.get_encryption_key(currentUser);
        let div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice",
            "Die Passw\u00F6rter werden auf dem Server verschl\u00FCsselt gespeichert, sodass nur Du die Passw\u00F6rter lesen kannst." +
            " Dazu ist ein Schl\u00FCssel erforderlich, der in Deinem Browser lokal gespeichert werden kann." +
            " Notiere den Schl\u00FCssel." +
            " Danach w\u00E4hle im Men\u00FC 'Schl\u00FCssel verbergen', um diesen Text auszublenden." +
            " Wenn der Schl\u00FCssel verloren geht, sind auch alle Daten verloren.");
        p = controls.create(div, "p");
        let elem = controls.createLabel(p, undefined, "Schl\u00FCssel:");
        elem.htmlFor = "input-encryptkey-id";
        elem = controls.createInputField(p, "Schl\u00FCssel", () => onChangeEncryptKey(), undefined, 32, 32);
        elem.id = "input-encryptkey-id";
        elem.addEventListener("change", () => onChangeEncryptKey());
        if (encryptKey) {
            elem.value = encryptKey;
        }
        p = controls.create(div, "p");
        let show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            "Schl\u00FCssel im Browser speichern", !show, () => onChangeEncryptKey());
        showEncryptKey(show);
        renderDropdownContent();
    };

    const renderPasswordItem = (parent, txt, desc, decode) => {
        if (txt.length == 0) return;
        if (decode) {
            decodeText(txt, (decoded) => renderPasswordItem(parent, decoded, desc), renderError);
            return;
        }
        let showButton = controls.createImageButton(parent, `${desc} anzeigen`, undefined,
            "/images/buttons/document-decrypt-3.png", 32, "transparent");
        controls.createImageButton(parent, `${desc} in die Zwischenablage kopieren`,
            () => {
                navigator.clipboard.writeText(txt);
            }, "/images/buttons/edit-copy-6.png", 32, "transparent");
        let span = controls.create(parent, "span", "pwditem");
        showButton.addEventListener("click", () => {
            let hide = span.textContent.length > 0;
            if (hide) {
                span.textContent = "";
                showButton.title = `${desc} anzeigen`;
                showButton.children[0].src = "/images/buttons/document-decrypt-3.png";
            }
            else {
                span.textContent = txt;
                showButton.title = `${desc} verbergen`;
                showButton.children[0].src = "/images/buttons/document-encrypt-3.png";
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
        const buttonBackDiv = controls.createDiv(parent);
        controls.createButton(buttonBackDiv, "OK", () => {
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
                controls.createImg(tdname, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
            }
            controls.createA(tdname, undefined, "#open", pwdItem.Name,
                () => renderPasswordItemDetails(pwdItems, pwdItem));
        });
    };

    const renderPasswordItems = (pwdItems) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        if (pwdItems.length > 0) {
            const filterDiv = controls.createDiv(parent);
            const searchLabel = controls.createLabel(filterDiv, undefined, "Filter:");
            searchLabel.htmlFor = "filter-id";
            filterInput = controls.createInputField(filterDiv, "Filter", undefined, undefined, 20, 32);
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
            renderError("Es wurde keine Passwortdatei hochgeladen.");
            showEncryptKey(true);
        }
        else if (!hasEncryptKey()) {
            renderError("Es fehlt der Schl\u00FCssel zum Dekodieren der Passwortdatei.");
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
                            renderError("Der Schl\u00FCssel zum Dekodieren der Passwortdatei ist nicht richtig.");
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
            let nexturl = "/password";
            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl);
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

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-password", undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, "OK", () => onUpdateHelp(false)).focus();
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

window.onload = () => utils.auth_lltoken(password.render);

window.onclick = (event) => {
    if (!event.target.matches(".dropbtn")) {
        let dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            let openDropdown = dropdowns[i];
            if (openDropdown.classList.contains("show")) {
                openDropdown.classList.remove("show");
            }
        }
    }
};