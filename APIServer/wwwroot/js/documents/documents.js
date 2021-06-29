"use strict";

var documents = (() => {

    // state

    let version = "1.0.5";
    let cryptoKey;
    let currentUser;
    let helpDiv;
    let waitDiv;

    let currentId;
    let docItems = [];
    let docItemsToMove = [];
    let currentIdBeforeMove = undefined;
    let move = false;

    // helper

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
        if (waitDiv) {
            waitDiv.className = wait ? "wait-div" : "invisible-div";
        }
    };

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
            return `${Math.floor(cnt / (1024 * 1024))} MB`;
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

    const uploadFiles = (curFiles) => {
        if (curFiles.length == 0) {
            setWaitCursor(false);
            initItems();
            return;
        }
        setWaitCursor(true);
        const curFile = curFiles[0];
        curFiles.shift();
        if (curFile.size < 10 * 1024 * 1024) {
            const fileReader = new FileReader();
            fileReader.onload = (e) => {
                initCryptoKey(() => {
                    const iv = window.crypto.getRandomValues(new Uint8Array(12));
                    const options = { name: "AES-GCM", iv: iv };
                    window.crypto.subtle.encrypt(options, cryptoKey, e.target.result)
                        .then(cipherData => {
                            const view = new Uint8Array(cipherData);
                            const data = new Uint8Array(cipherData.byteLength + 12);
                            data.set(iv, 0);
                            data.set(view, 12);
                            const encryptedFile = new File([data.buffer], curFile.name, { type: "application/octet-stream" });
                            const formData = new FormData();
                            formData.append("document-file", encryptedFile);
                            const token = utils.get_authentication_token();
                            utils.fetch_api_call(`api/document/upload/${currentId}`,
                                {
                                    method: "POST",
                                    headers: { "token": token },
                                    body: formData
                                },
                                () => uploadFiles(curFiles),
                                (errMsg) => initItems(`Hochladen von ${curFile.name} ist fehlgeschlagen: ${errMsg}`));
                        })
                        .catch(err => initItems(`Hochladen von ${curFile.name} ist fehlgeschlagen: ${err.message}`));
                });
            };
            fileReader.readAsArrayBuffer(curFile);
        }
        else {
            initItems(`Datei '${curFile.name}' ist zu gross! Bis 10 MB sind erlaubt.`);
        }
    };

    const isContainer = (item) => item.type === "Folder" || item.type === "Volume";

    const isDocument = (item) => item.type === "Document";

    const createVolume = (name) => {
        const token = utils.get_authentication_token();
        utils.fetch_api_call("api/document/volume",
            {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify(name)
            },
            renderState, renderError, setWaitCursor);
    };

    const initItems = (errMsg) => {
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
                    renderState(errMsg);
                }
            }, renderError, setWaitCursor);
    };

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
        setWaitCursor(false);
        if (!errMsg) errMsg = "";
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
        const className = (pathItem.id == currentId) ? "currentfolder" : undefined;
        const a = controls.createA(span, className, "#open", pathItem.name);
        a.id = `item-path-id-${pathItem.id}`;
        a.addEventListener("click", onClickPathItem);
    };

    const renderCurrentPath = () => {
        const elem = document.getElementById("currentpath-id");
        controls.removeAllChildren(elem);
        if (move) {
            controls.createSpan(elem, "path-item", "> ");
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
            // @TODO: quota not yet implemented
            // title = "Noch 100 MB frei f\u00FCr Dokumente.";
        }
        controls.createSpan(elem, undefined, title);
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
        const tr = controls.create(tbody, "tr");
        let td = controls.create(tr, "td", "column1");
        if (items.length > 0) {
            const checkBox = controls.createCheckbox(td, "item-select-all-id", "item-select-all");
            checkBox.addEventListener("click", onSelectAll);
        }
        td = controls.create(tr, "td", "column2");
        td = controls.create(tr, "td");
        td = controls.create(tr, "td");
        items.forEach(item => {
            const tr = controls.create(tbody, "tr");
            renderDocItem(tr, item);
        });
        table.addEventListener("click", onClickItem);
        table.addEventListener("dragover", (evt) => {
            evt.preventDefault();
            evt.dataTransfer.dropEffect = "copy";
        });
        table.addEventListener("drop", (evt) => {
            evt.preventDefault();
            if (evt.dataTransfer.items) {
                const curFiles = [];
                for (let i = 0; i < evt.dataTransfer.items.length; i++) {
                    const dti = evt.dataTransfer.items[i];
                    if (dti.kind === "file") {
                        curFiles.push(dti.getAsFile());
                    }
                }
                uploadFiles(curFiles);
            }
        });
    };

    const renderUploadDocument = (parent) => {
        const form = controls.create(parent, "form");
        form.id = "form-id";
        form.method = "post";
        form.enctype = "multipart/formdata";
        const inputFile = controls.create(form, "input");
        inputFile.type = "file";
        inputFile.name = "file-input";
        inputFile.id = "file-input-id";
        inputFile.multiple = true;
        inputFile.addEventListener("change", onAddDocument);
    };

    const renderState = (errMsg) => {
        renderCurrentPath();
        renderError(errMsg);
        renderFilter();
        renderActions();
        renderTitle();
        renderDocItemsTable();
    };

    const renderPage = () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        waitDiv = controls.createDiv(parent, "invisible-div");
        renderEncryptKey(parent);
        controls.createDiv(parent, "currentpath").id = "currentpath-id";
        controls.createDiv(parent, "error").id = "error-id";
        controls.createDiv(parent, "filter").id = "filter-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "title").id = "title-id";
        controls.createDiv(parent, "action").id = "action-id";
        renderCopyright(parent);
        renderUploadDocument(parent);
    };

    const render = () => {
        cryptoKey = undefined;
        const token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/documents";
            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl);
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPage();
                initItems();
            },
            renderError, setWaitCursor);
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
            initItems();
        }
    };

    const onClickPathItem = (evt) => {
        if (evt.target.id.startsWith("item-path-id-")) {
            const id = parseInt(evt.target.id.substr(13));
            const item = getItem(id);
            if (item !== undefined && isContainer(item)) {
                currentId = id;
                initItems();
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
                initItems();
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
        const curFiles = [];
        for (let i = 0; i < inputFile.files.length; i++) {
            curFiles.push(inputFile.files[i]);
        }
        uploadFiles(curFiles);
    };
    
    const onDownloadDocument = (id) => {
        setWaitCursor(true);
        const item = getItem(id);
        const token = utils.get_authentication_token();
        fetch(`api/document/download/${id}`, { headers: { "token": token } })
            .then(resp => resp.blob())
            .then(blob => {
                const iv = new Uint8Array(12);
                const data = new Uint8Array(blob.size - 12);
                let idx = 0;
                const reader = blob.stream().getReader();
                reader.read().then(
                    function processData({ done, value }) {
                        if (done) {
                            initCryptoKey(() => {
                                const options = { "name": "AES-GCM", "iv": iv };
                                crypto.subtle.decrypt(options, cryptoKey, data)
                                    .then(decrypted => {
                                        const obj_url = URL.createObjectURL(new Blob([decrypted]));
                                        let a = document.createElement("a");
                                        a.href = obj_url;
                                        a.setAttribute("download", item.name);
                                        a.click();
                                        URL.revokeObjectURL(obj_url);
                                        setWaitCursor(false);
                                    })
                                    .catch(err => renderError(err.message));
                            });
                            return;
                        }
                        value.forEach(val => {
                            if (idx < 12) {
                                iv[idx] = val;
                            }
                            else {
                                data[idx - 12] = val;
                            }
                            idx++;
                        });
                        return reader.read().then(processData);
                    });
            })
            .catch((err) => renderError(err.message));
    };

    const onSelectDestinationFolder = () => {
        const selected = getSelected();
        if (selected.length > 0) {
            move = true;
            docItemsToMove = selected;
            currentIdBeforeMove = currentId;
            initItems();
        }
    };

    const onMoveDocuments = () => {
        const selected = getSelected();
        if (selected.length == 1 && isContainer(selected[0]) && docItemsToMove.length > 0) {
            const ids = docItemsToMove.map(item => item.id);
            const token = utils.get_authentication_token();
            move = false;
            docItemsToMove = [];
            currentId = currentIdBeforeMove;
            currentIdBeforeMove = undefined;
            utils.fetch_api_call(`api/document/items/${selected[0].id}`,
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(ids)
                },
                () => initItems(),
                renderError, setWaitCursor);
        }
    };

    const onCancelMoveDocuments = () => {
        if (move) {
            move = false;
            docItemsToMove = [];
            currentId = currentIdBeforeMove;
            currentIdBeforeMove = undefined;
            renderState();
        }
    };

    const onGotoUp = () => {
        const item = getItem(currentId);
        currentId = item.parentId;
        initItems();
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
        controls.createButton(elem, "Abbrechen", () => renderState());
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
                () => initItems(),
                renderError, setWaitCursor);
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
            controls.createButton(elem, "Abbrechen", () => renderState());
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
                    () => initItems(), renderError, setWaitCursor);
            }
        }
    };

    const onConfirmDeleteDocuments = () => {
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        controls.createSpan(elem, undefined, "Willst Du die ausgew\u00E4hlten Elemente wirklich l\u00F6schen?  ");
        controls.createButton(elem, "Ja", onDeleteDocuments);
        controls.createButton(elem, "Nein", () => initItems());
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
                () => initItems(), renderError, setWaitCursor);
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