"use strict";

var documents = (() => {

    // state

    let version = "0.0.3";
    let cryptoKey;
    let currentUser;
    let helpDiv;

    let currentId;
    let docItems = [];
    let docItemsToMove = [];
    let currentIdBeforeMove = undefined;
    let move = false;

    // helper

    const hasEncryptKey = () => {
        const elem = document.getElementById("input-encryptkey-id");
        return elem && elem.value.trim().length > 0;
    }

    const initCryptoKey = (resolve, reject) => {
        if (!cryptoKey) {
            const elem = document.getElementById("input-encryptkey-id");
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

    const encodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    const decodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    const showEncryptKey = (show) => {
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!encryptKeyElem) return;
        if (show || !utils.has_viewed_encryption_key(currentUser)) {
            encryptKeyElem.classList.add("show");
        }
        else {
            encryptKeyElem.classList.remove("show");
        }
        renderDropdownContent();
    };

    const formatSize = (cnt) => {
        if (cnt >= 1024 * 1024) {
            return `${Math.floor(cnt / 1024 * 1024)} MB`;
        }
        if (cnt >= 1024) {
            return `${Math.floor(cnt / 1024)} KB`;
        }
        return `${cnt} B`;
    }

    const getPath = (id) => {
        const items = [];
        while (id !== undefined) {
            const item = getItem(id);
            if (item === undefined) break;
            items.push(item);
            id = item.parentId;
        }
        items.reverse();
        return items;
    };

    const getItems = (parentId) => {
        const items = [];
        docItems.forEach(item => {
            if (item.parentId === parentId) {
                if (!move || isContainer(item)) {
                    items.push(item);
                }
            }
        });
        return sortItems(items);
    }

    const getVolume = () => {
        return docItems.find(item => item.type == "Volume");
    }

    const getItem = (id) => {
        return docItems.find(item => item.id === id);
    }

    const getSelected = () => {
        const selected = [];
        document.querySelectorAll(".item-select").forEach(
            elem => {
                if (elem.checked) {
                    const docItem = docItems.find(d => elem.id == `item-select-id-${d.id}`);
                    if (docItem !== undefined) {
                        selected.push(docItem);
                    }
                }
            });
        return selected;
    };

    const updateAllSelections = (checked) => {
        document.querySelectorAll(".item-select").forEach(
            elem => {
                if (elem.checked != checked) {
                    elem.checked = checked;
                }
            });
    };

    const sortItems = (items) => {
        items.sort((item1, item2) => {
            if (item1.type != item2.type) {
                if (isContainer(item1)) return -1;
                return 1;
            }
            if (item1.name > item2.name) return 1;
            if (item1.name < item2.name) return -1;
            return 0;
        });
        return items;
    };

    const isContainer = (item) => item.type === "Folder" || item.type === "Volume";

    const isDocument = (item) => item.type === "Document";

    // rendering

    const renderDropdown = (parent) => {
        const dropdownDiv = controls.create(parent, "div", "dropdown");
        const dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        const dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        const parent = document.getElementById("dropdown-id");
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!parent || !encryptKeyElem) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/documents", "Dokumente");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/skat", "Skat");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.createA(parent, undefined, "/tetris", "Tetris");
        controls.create(parent, "hr");
        if (currentUser.hasPasswordManagerFile) {
            controls.createA(parent, undefined, "/password", "Passw\u00F6rter");
        }
        controls.createA(parent, undefined, "/usermgmt", "Profil");
        controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/markdown?page=welcome", "Willkommen");
        controls.create(parent, "hr");
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
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - Dokumente`);
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
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Documents ${version}. Copyright 2021 `);
        controls.createA(div, "copyright", "/markdown?page=homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
    };

    const renderError = (errMsg) => {
        const elem = document.getElementById("error-id");
        if (elem) {
            elem.textContent = errMsg;
        }
        else {
            const parent = document.body;
            controls.removeAllChildren(parent);
            renderHeader(parent, "Es ist ein Fehler aufgetreten.");
            controls.createDiv(parent, "error").textContent = errMsg;
            renderCopyright(parent);
        }
    };

    const renderEncryptKey = (parent) => {
        renderDropdown(parent);
        renderHeader(parent);
        const encryptKey = utils.get_encryption_key(currentUser);
        const div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice",
            "Die Dokumente werden auf dem Server verschl\u00FCsselt gespeichert, sodass nur Du sie lesen kannst." +
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
        const show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            "Schl\u00FCssel im Browser speichern", !show, () => onChangeEncryptKey());
        showEncryptKey(show);
        renderDropdownContent();
    };

    const renderPathItem = (parent, pathItem, index) => {
        const sep = index === 0 && !move ? "> " : " > ";
        const span = controls.createSpan(parent, "path-item", sep);
        if (pathItem.id != currentId) {
            const a = controls.createA(span, undefined, "#", pathItem.name);
            a.id = `item-path-id-${pathItem.id}`;
            a.addEventListener("click", onClickPathItem);
        }
        else {
            controls.createSpan(span, "", pathItem.name);
        }
    };

    const renderCurrentPath = () => {
        const elem = document.getElementById("currentpath-id");
        controls.removeAllChildren(elem);
        if (move) {
            const span = controls.createSpan(elem, "path-item", "> ");
            if (currentId !== undefined) {
                const a = controls.createA(elem, undefined, "#", "Start");
                a.addEventListener("click", onClickStart);
            }
            else {
                controls.createSpan(elem, "", "Start");
            }
        }
        const currentPath = getPath(currentId);
        currentPath.forEach((pathItem, index) => renderPathItem(elem, pathItem, index));
    };

    const renderTitle = () => {
        const elem = document.getElementById("title-id");
        controls.removeAllChildren(elem);
        const cnt = move ? docItemsToMove.length : getSelected().length;
        let title;
        if (cnt > 0) {
            title = `${cnt} Element(e) ausgew\u00E4hlt.`;
            if (move) {
                title += " W\u00E4hle den Zielordner aus f\u00FCr das Verschieben.";
            }
        }
        else {
            title = "Noch 100 MB frei f\u00FCr Dokumente.";
        }
        controls.create(elem, "span", undefined, title);
    };

    const renderActions = () => {
        const cnt = getSelected().length;
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        if (move) {
            if (cnt == 1) {
                controls.createButton(elem, "Verschieben", onMoveDocuments);
            }
            controls.createButton(elem, "Abbrechen", onCancelMoveDocuments);
            if (currentId > 0) {
                controls.createButton(elem, "Zur\u00FCck", onGotoUp);
            }
        }
        else {
            if (cnt == 1) {
                controls.createButton(elem, "Umbenennen", onConfirmRename);
            }
            if (cnt > 0) {
                controls.createButton(elem, "Verschieben", onSelectDestinationFolder);
                controls.createButton(elem, "L\u00F6schen", onConfirmDeleteDocuments);
            }
            else {
                controls.createButton(elem, "Ordner anlegen", onConfirmAddFolder);
                controls.createButton(elem, "Dokument hochladen", onSelectFile);
                if (currentId > 1) {
                    controls.createButton(elem, "Zur\u00FCck", onGotoUp);
                }
            }
        }
    };

    const renderFilter = () => {
        const elem = document.getElementById("filter-id");
        controls.removeAllChildren(elem);
        const searchLabel = controls.createLabel(elem, undefined, "Filter:  ");
        searchLabel.htmlFor = "filter-input-id";
        const filterInput = controls.createInputField(elem, "Filter", undefined, undefined, 32, 255);
        filterInput.id = "filter-input-id";
        filterInput.addEventListener("input", () => onFilterItems());
        if (!utils.is_mobile()) {
            filterInput.focus();
        }
    };

    const renderDocItem = (tr, item, selected) => {
        let td = controls.create(tr, "td", "column1");
        const checkBox = controls.createCheckbox(td, `item-select-id-${item.id}`);
        checkBox.classList += "item-select";
        if (selected) {
            checkBox.checked = true;
        }
        td = controls.create(tr, "td", "column2");
        const url = isContainer(item) ? "/images/buttons/folder.png" : "/images/buttons/applications-office-6.png";
        const img = controls.createImg(td, undefined, 32, 32, url);
        img.title = isContainer(item) ? "Ordner" : "Dokument";
        img.id = `item-open-id-${item.id}`;
        td = controls.create(tr, "td");
        const a = controls.createA(td, undefined, "#open", item.name);
        a.id = `item-open-id-${item.id}`;
        td = controls.create(tr, "td");
        if (isContainer(item)) {
            td.textContent = `${item.children}`;
        }
        else {
            td.textContent = formatSize(item.size);
        }
    };

    const renderDocItemsTable = (filteredItems) => {
        const childItems = getItems(currentId);
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        const table = controls.create(parent, "table");
        const tbody = controls.create(table, "tbody", "table-content");
        const items = filteredItems ? filteredItems : childItems;
        if (items.length > 0) {
            const tr = controls.create(tbody, "tr");
            let td = controls.create(tr, "td", "column1");
            const checkBox = controls.createCheckbox(td, "item-select-all-id");
            checkBox.addEventListener("click", onSelectAll);
            td = controls.create(tr, "td", "column2");
            td = controls.create(tr, "td");
            td = controls.create(tr, "td");
        }
        items.forEach(item => {
            const tr = controls.create(tbody, "tr");
            renderDocItem(tr, item);
        });
        table.addEventListener("click", onClickItem);
    };

    const renderUploadDocument = (parent) => {
        const form = controls.create(parent, "form");
        form.id = "form-id";
        form.method = "post";
        form.enctype = "multipart/formdata";
        const inputFile = controls.create(form, "input");
        inputFile.type = "file";
        inputFile.name = "file-input";
        inputFile.accept = "application/octet-stream";
        inputFile.id = "file-input-id";
        inputFile.addEventListener("change", onAddDocument);
    };

    const renderPage = (parent) => {
        renderEncryptKey(parent);
        controls.createDiv(parent, "currentpath").id = "currentpath-id";
        controls.createDiv(parent, "error").id = "error-id";
        controls.createDiv(parent, "filter").id = "filter-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "title").id = "title-id";
        controls.createDiv(parent, "action").id = "action-id";
        renderCurrentPath();
        renderError("");
        renderFilter();
        renderActions();
        renderTitle();
        renderCopyright(parent);
        renderUploadDocument(parent);
        renderDocItemsTable();
    };

    const render = () => {
        parent = document.body;
        controls.removeAllChildren(parent);
        cryptoKey = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            let nexturl = "/documents";
            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl);
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                initItems();
            },
            renderError);
    };

    // --- callbacks

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call("/api/pwdman/markdown/help-documents", undefined, (html) => mdDiv.innerHTML = html);
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
    };

    const onClickStart = () => {
        const volume = getVolume();
        if (volume !== undefined) {
            currentId = volume.parentId;
            render();
        }
    };

    const onClickPathItem = (evt) => {
        if (evt.target.id.startsWith("item-path-id-")) {
            const id = parseInt(evt.target.id.substr(13));
            const item = getItem(id);
            if (item !== undefined && isContainer(item) && id != currentId) {
                currentId = id;
                render();
            }
        }
    };

    const onClickItem = (evt) => {
        if (evt.target.id.startsWith("item-select-id-")) {
            document.getElementById("item-select-all-id").checked = false;
            renderTitle();
            renderActions();
        }
        else if (evt.target.id.startsWith("item-open-id-")) {
            const id = parseInt(evt.target.id.substr(13));
            const item = getItem(id);
            if (isContainer(item)) {
                currentId = id;
                render();
            }
            else if (isDocument(item)) {
                onDownloadDocument(id);
            }
        }
        else if (evt.target.tagName != "SPAN" && evt.target.id != "item-select-all-id") {
            updateAllSelections(false);
            renderActions();
            renderTitle();
        }
    };

    const onSelectAll = (evt) => {
        updateAllSelections(evt.target.checked);
        renderActions();
        renderTitle();
    };

    const onSelectFile = () => {
        const inputFile = document.getElementById("file-input-id");
        if (inputFile) {
            inputFile.click();
        }
    };

    const onAddDocument = () => {
        const inputFile = document.getElementById("file-input-id");
        if (inputFile.files.length == 1) {
            const curFile = inputFile.files[0];
            if (curFile.size < 10 * 1024 * 1024) {
                const fileReader = new FileReader();
                fileReader.onload = (e) => {
                    console.log(e.target.result);
                    initCryptoKey(() => {
                        const iv = window.crypto.getRandomValues(new Uint8Array(12));
                        const options = { name: "AES-GCM", iv: iv };
                        window.crypto.subtle.encrypt(options, cryptoKey, e.target.result)
                            .then(cipherText => {
                                let formData = new FormData();
                                var encryptedFile = new File([cipherText], curFile.name, { type: "application/octet-stream" });
                                formData.append("document-file", encryptedFile);
                                const token = utils.get_authentication_token();
                                utils.fetch_api_call(`api/document/upload/${currentId}`,
                                    {
                                        method: "POST",
                                        headers: { "token": token },
                                        body: formData
                                    },
                                    render, renderError);
                            })
                            .catch(err => renderError(err.message));
                    });
                };
                fileReader.readAsArrayBuffer(curFile);
            }
        }
    };

    const onDownloadDocument = (id) => {
        const item = getItem(id);
        console.log("Here we are!");
        let token = utils.get_authentication_token();
        fetch(`api/document/download/${id}`, { headers: { "token": token } })
            .then(resp => resp.blob())
            .then(blob => {
                const obj_url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = obj_url;
                a.setAttribute("download", item.name);
                a.click();
                URL.revokeObjectURL(obj_url);
            })
            .catch((err) => renderError(err.message));
    };

    const onSelectDestinationFolder = () => {
        const selected = getSelected();
        if (selected.length > 0) {
            move = true;
            docItemsToMove = selected;
            currentIdBeforeMove = currentId;
            render();
        }
    };

    const onMoveDocuments = () => {
        const selected = getSelected();
        if (selected.length == 1 && isContainer(selected[0]) && docItemsToMove.length > 0) {
            const ids = docItemsToMove.map(item => item.id);
            let token = utils.get_authentication_token();
            utils.fetch_api_call(`api/document/items/${selected[0].id}`,
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(ids)
                },
                render, renderError);
            move = false;
            docItemsToMove = [];
            currentId = currentIdBeforeMove;
            currentIdBeforeMove = undefined;
            render();
        }
    };

    const onCancelMoveDocuments = () => {
        if (move) {
            move = false;
            docItemsToMove = [];
            currentId = currentIdBeforeMove;
            currentIdBeforeMove = undefined;
            render();
        }
    };

    const onGotoUp = () => {
        const item = getItem(currentId);
        currentId = item.parentId;
        render();
    };

    const onConfirmAddFolder = () => {
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        const label = controls.createLabel(elem, undefined, "Name:");
        label.htmlFor = "create-name-input-id";
        const name = controls.createInputField(elem, "Name", onAddFolder, undefined, 32, 255);
        name.id = "create-name-input-id";
        controls.createSpan(elem, undefined, "  ");
        controls.createButton(elem, "Anlegen", onAddFolder);
        controls.createButton(elem, "Abbrechen", render);
        if (!utils.is_mobile()) {
            name.focus();
        }
    };

    const onAddFolder = () => {
        const elem = document.getElementById("create-name-input-id");
        const val = elem.value.trim();
        if (val.length > 0) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call(`api/document/folder/${currentId}`,
                {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(val)
                },
                render, renderError);
        }
    };

    const onConfirmRename = () => {
        const selected = getSelected();
        if (selected.length == 1) {
            const elem = document.getElementById("action-id");
            controls.removeAllChildren(elem);
            const label = controls.createLabel(elem, undefined, "Name:");
            label.htmlFor = "rename-name-input-id";
            const name = controls.createInputField(elem, "Name", onRename, undefined, 32, 255);
            name.id = "rename-name-input-id";
            name.value = selected[0].name;
            controls.createSpan(elem, undefined, "  ");
            controls.createButton(elem, "Umbenennen", onRename);
            controls.createButton(elem, "Abbrechen", render);
            if (!utils.is_mobile()) {
                name.focus();
            }
        }
    };

    const onRename = () => {
        const selected = getSelected();
        if (selected.length == 1) {
            const elem = document.getElementById("rename-name-input-id");
            const val = elem.value.trim();
            if (val.length > 0 && selected[0].name != val) {
                const token = utils.get_authentication_token();
                utils.fetch_api_call(`api/document/item/${selected[0].id}`,
                    {
                        method: "PUT",
                        headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                        body: JSON.stringify(val)
                    },
                    render, renderError);
            }
        }
    };

    const onConfirmDeleteDocuments = () => {
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        controls.createSpan(elem, undefined, "Willst Du die ausgew\u00E4hlten Elemente wirklich l\u00F6schen?  ");
        controls.createButton(elem, "Ja", onDeleteDocuments);
        controls.createButton(elem, "Nein", render);
    };

    const onDeleteDocuments = () => {
        const selected = getSelected();
        if (selected.length > 0) {
            const ids = selected.map(item => item.id);
            let token = utils.get_authentication_token();
            utils.fetch_api_call(`api/document/items/${currentId}`,
                {
                    method: "DELETE",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(ids)
                },
                render, renderError);
        }
    };

    const onFilterItems = () => {
        const filterInput = document.getElementById("filter-input-id");
        const v = filterInput.value.toLowerCase();
        let filteredItems = undefined;
        if (v.length > 0) {
            const items = getItems(currentId);
            filteredItems = [];
            items.forEach(item => {
                if (item.name.toLowerCase().startsWith(v)) {
                    filteredItems.push(item);
                }
            });
        }
        renderDocItemsTable(filteredItems);
    };

    const initItems = () => {
        const token = utils.get_authentication_token();
        let url = "api/document/items";
        if (Number.isInteger(currentId)) {
            url += `/${currentId}`;
        }
        utils.fetch_api_call(url, { headers: { "token": token } },
            (items) => {
                docItems = [];
                items.forEach(item => {
                    docItems.push(item);
                });
                const volume = getVolume();
                if (volume === undefined) {
                    createVolume("Dokumente");
                }
                else {
                    if (currentId === undefined) {
                        currentId = volume.id;
                    }
                    renderPage(document.body);
                }
            }, renderError);
    };

    const createVolume = (name) => {
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/document/volume",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            render, renderError);
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => utils.auth_lltoken(documents.render);

window.onclick = (event) => {
    if (!event.target.matches(".dropbtn")) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains("show")) {
                openDropdown.classList.remove("show");
            }
        }
    }
};