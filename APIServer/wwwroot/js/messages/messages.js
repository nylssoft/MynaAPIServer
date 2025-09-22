var messages = (() => {

    "use strict";

    // state

    let version = "0.0.1";
    let cryptoKey;
    let currentUser;
    let helpDiv;
    let waitDiv;

    let currentId;
    let volumeId;
    let docItems = [];
    let docItemsToMove = [];
    let currentIdBeforeMove;
    let move = false;

    let updateMarkdownItem;
    let markdownItemModified;

    let rsaKeyPair;

    // helper

    const setWaitCursor = (wait) => {
        document.body.style.cursor = wait ? "wait" : "default";
//        if (waitDiv) {
//            waitDiv.className = wait ? "wait-div" : "invisible-div";
//        }
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
    };

    const getVolume = () => {
        return docItems.find(item => item.type == "Volume");
    };

    const getItem = (id) => {
        return docItems.find(item => item.id === id);
    };

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

    const upload = (fileData, curFile, curFiles, overwrite) => {
        const parent = getItem(currentId);
        if (isContainer(parent)) {
            if (parent.accessRole && parent.accessRole.length > 0) {
                uploadShared(fileData, curFile, curFiles, overwrite);
            }
            else {
                uploadEncrypted(fileData, curFile, curFiles, overwrite);
            }
        }
    };

    const uploadShared = (fileData, curFile, curFiles, overwrite) => {
        const dataFile = new File([fileData], curFile.name, { type: "application/octet-stream" });
        const formData = new FormData();
        formData.append("document-file", dataFile);
        formData.append("overwrite", overwrite);
        const token = utils.get_authentication_token();
        utils.fetch_api_call(`api/document/upload/${currentId}`,
            {
                method: "POST",
                headers: { "token": token },
                body: formData
            },
            () => uploadFiles(curFiles, overwrite),
            (errMsg) => initItems(_T("ERROR_UPLOAD_DOCUMENT_1_2", curFile.name, _T(errMsg))));
    };

    const uploadEncrypted = (fileData, curFile, curFiles, overwrite) => {
        initCryptoKey(() => {
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const options = { name: "AES-GCM", iv: iv };
            window.crypto.subtle.encrypt(options, cryptoKey, fileData)
                .then(cipherData => {
                    const view = new Uint8Array(cipherData);
                    const data = new Uint8Array(cipherData.byteLength + 12);
                    data.set(iv, 0);
                    data.set(view, 12);
                    const encryptedFile = new File([data.buffer], curFile.name, { type: "application/octet-stream" });
                    const formData = new FormData();
                    formData.append("document-file", encryptedFile);
                    formData.append("overwrite", overwrite);
                    const token = utils.get_authentication_token();
                    utils.fetch_api_call(`api/document/upload/${currentId}`,
                        {
                            method: "POST",
                            headers: { "token": token },
                            body: formData
                        },
                        () => uploadFiles(curFiles, overwrite),
                        (errMsg) => initItems(_T("ERROR_UPLOAD_DOCUMENT_1_2", curFile.name, _T(errMsg))));
                })
                .catch(err => initItems(_T("ERROR_UPLOAD_DOCUMENT_1_2", curFile.name, err.message)));
        });
    };

    const onConfirmOverwrite = (curFiles) => {
        const itemNames = getItems(currentId).map(item => item.name);
        const existing = [];
        curFiles.forEach(curFile => {
            if (itemNames.includes(curFile.name)) {
                existing.push(curFile.name);
            }
        });
        if (existing.length > 0) {
            const toolbar = document.getElementById("toolbar-id");
            controls.removeAllChildren(toolbar);
            const elem = document.getElementById("action-id");
            controls.removeAllChildren(elem);
            let msg;
            if (existing.length == 1) {
                msg = _T("INFO_REALLY_OVERWRITE_DOC_1", existing[0]);
            }
            else {
                msg = _T("INFO_REALLY_OVERWRITE_DOCS_1", existing.join(", "));
            }
            controls.createSpan(elem, undefined, msg);
            controls.createButton(elem, _T("BUTTON_YES"), () => uploadFiles(curFiles, true));
            controls.createButton(elem, _T("BUTTON_NO"), () => uploadFiles(curFiles, false));
            controls.createButton(elem, _T("BUTTON_CANCEL"), () => initItems());
            elem.scrollIntoView();
        }
        else {
            uploadFiles(curFiles, false);
        }
    };

    const uploadFiles = (curFiles, overwrite) => {
        if (curFiles.length == 0) {
            setWaitCursor(false);
            initItems();
            return;
        }
        setWaitCursor(true);
        const curFile = curFiles[0];
        curFiles.shift();
        if (curFile.size < 20 * 1024 * 1024) {
            const fileReader = new FileReader();
            fileReader.onload = (e) => upload(e.target.result, curFile, curFiles, overwrite);
            fileReader.readAsArrayBuffer(curFile);
        }
        else {
            initItems(_T("INFO_UPLOAD_DOC_TOO_LARGE_1", curFile.name));
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
            (volume) => {
                docItems.push(volume);
                volumeId = volume.id;
                currentId = volume.id;
                renderState();
            },
            renderError, setWaitCursor);
    };

    const initItems = (errMsg) => {
        const token = utils.get_authentication_token();
        let url = "api/message";
        utils.fetch_api_call(url, { headers: { "token": token } },
            (items) => {
                docItems = [];
                items.forEach(item => {
                    docItems.push(item);
                });
            }, renderError, setWaitCursor);
    };

    // rendering

    const renderHeader = (parent) => {
        helpDiv = controls.createDiv(document.body);
        const h1 = controls.create(parent, "h1", undefined, `${currentUser.name} - ${_T("HEADER_DOCUMENTS")}`);
        const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
        helpImg.addEventListener("click", () => onUpdateHelp(true));
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_DOCUMENTS")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
        controls.createA(div, "copyright", "/view?page=copyright", _T("COPYRIGHT"));
        controls.create(div, "span", "copyright", ".");
    };

    const renderError = (errMsg) => {
        setWaitCursor(false);
        /*
        if (!errMsg) errMsg = "";
        const elem = document.getElementById("error-id");
        if (elem) {
            elem.textContent = _T(errMsg);
        }
        else {
            const parent = document.body;
            controls.removeAllChildren(parent);
            renderHeader(parent, _T("INFO_ERROR_OCCURED"));
            controls.createDiv(parent, "error").textContent = _T(errMsg);
            renderCopyright(parent);
        }
        */
    };

    const renderEncryptKeyAsync = async (parent) => {
        utils.create_menu(parent);
        renderHeader(parent);
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        const div = controls.createDiv(parent, "hide");
        div.id = "div-encryptkey-id";
        let p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_DOCS"));
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
        const show = encryptKey == undefined;
        elem = controls.createCheckbox(p, "checkbox-save-encryptkey-id", undefined,
            _T("OPTION_SAVE_KEY_IN_BROWSER"), !show, () => onChangeEncryptKeyAsync());
        utils.show_encrypt_key(currentUser, show);
        utils.set_menu_items(currentUser);
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
        if (updateMarkdownItem) {
            controls.createSpan(elem, undefined, `${updateMarkdownItem.name} (${updateMarkdownItem.id})`);
            return;
        }
        if (move) {
            controls.createSpan(elem, "path-item", "> ");
            if (currentId !== undefined) {
                const a = controls.createA(elem, undefined, "#", _T("TEXT_START"));
                a.addEventListener("click", onClickStart);
            }
            else {
                controls.createSpan(elem, "", _T("TEXT_START"));
            }
        }
        const currentPath = getPath(currentId);
        currentPath.forEach((pathItem, index) => renderPathItem(elem, pathItem, index));
    };

    const renderTitle = () => {
        const elem = document.getElementById("title-id");
        controls.removeAllChildren(elem);
        if (updateMarkdownItem) {
            return;
        }
        const cnt = move ? docItemsToMove.length : getSelected().length;
        let title;
        if (cnt > 0) {
            title = _T("INFO_ELEMENTS_SELECTED_1", cnt);
            if (move) {
                title += " " + _T("INFO_SELECT_DEST_FOLDER_MOVE");
            }
        }
        controls.createSpan(elem, undefined, title);
    };

    const renderActions = () => {
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        if (updateMarkdownItem) {
            const saveButton = controls.createButton(elem, _T("BUTTON_SAVE"), onUpdateMarkdown);
            saveButton.id = "savebutton-id";
            saveButton.style.display = markdownItemModified ? "inline" : "none";
            controls.createButton(elem, _T("BUTTON_CANCEL"), onCancelEditMarkdown);
            return;
        }
        const toolbar = document.getElementById("toolbar-id");
        controls.removeAllChildren(toolbar);
        const selected = getSelected();
        const cnt = selected.length;
        if (move) {
            if (cnt == 1) {
                controls.createButton(elem, _T("BUTTON_MOVE"), onMoveDocuments);
                const btnPaste = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/edit-paste-3.png", _T("BUTTON_MOVE"));
                btnPaste.addEventListener("click", onMoveDocuments);
            }
            controls.createButton(elem, _T("BUTTON_CANCEL"), onCancelMoveDocuments);
            if (currentId !== null) {
                controls.createButton(elem, _T("BUTTON_BACK"), onGotoUp);
                const btnUp = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/go-up-10.png", _T("BUTTON_BACK"));
                btnUp.addEventListener("click", onGotoUp);
            }
        }
        else {
            if (cnt == 1) {
                const currentItem = selected[0];
                controls.createButton(elem, _T("BUTTON_RENAME"), onConfirmRename);
                const btnRename = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/edit-rename.png", _T("BUTTON_RENAME"));
                btnRename.addEventListener("click", onConfirmRename);                
                if (currentUser.roles.includes("usermanager") && isContainer(currentItem)) {
                    controls.createButton(elem, _T("BUTTON_PUBLISH"), onConfirmPublish);
                }
                if (isDocument(currentItem) && currentItem.name.endsWith(".md") &&
                    currentItem.accessRole && currentItem.accessRole.length > 0) {
                    controls.createButton(elem, _T("BUTTON_EDIT"), onEditMarkdown);
                }
            }
            if (cnt > 0) {
                controls.createButton(elem, _T("BUTTON_MOVE"), onSelectDestinationFolder);
                const btnCut = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/edit-cut-5.png", _T("BUTTON_MOVE"));
                btnCut.addEventListener("click", onSelectDestinationFolder);
                controls.createButton(elem, _T("BUTTON_DELETE"), onConfirmDeleteDocuments);
                const btnDelete = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/edit-delete-6.png", _T("BUTTON_DELETE"));
                btnDelete.addEventListener("click", onConfirmDeleteDocuments);
            }
            else {
                controls.createButton(elem, _T("BUTTON_CREATE_FOLDER"), onConfirmAddFolder);
                const btnAddFolder = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/folder-new-2.png", _T("BUTTON_CREATE_FOLDER"));
                btnAddFolder.addEventListener("click", onConfirmAddFolder);
                controls.createButton(elem, _T("BUTTON_UPLOAD_DOCUMENT"), onSelectFile);
                const btnUploadDocument = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/list-add-4.png", _T("BUTTON_UPLOAD_DOCUMENT"));
                btnUploadDocument.addEventListener("click", onSelectFile);
                if (currentId !== null && currentId !== volumeId) {
                    controls.createButton(elem, _T("BUTTON_BACK"), onGotoUp);
                    const btnUp = controls.createImg(toolbar, "toolbar-button", 32, 32, "/images/buttons/go-up-10.png", _T("BUTTON_BACK"));
                    btnUp.addEventListener("click", onGotoUp);
                }
            }
        }
    };

    const renderFilter = () => {
        const elem = document.getElementById("filter-id");
        controls.removeAllChildren(elem);
        if (updateMarkdownItem) {
            return;
        }
        const searchLabel = controls.createLabel(elem, undefined, _T("LABEL_FILTER") + "  ");
        searchLabel.htmlFor = "filter-input-id";
        const filterInput = controls.createInputField(elem, _T("TEXT_FILTER"), undefined, undefined, 32, 255);
        filterInput.id = "filter-input-id";
        filterInput.addEventListener("input", () => onFilterItems());
        const toolbar = controls.createDiv(elem, "toolbar");
        toolbar.id = "toolbar-id";
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
        const img = controls.createImg(td, undefined, 32, 32, url, isContainer(item) ? _T("TEXT_FOLDER") : _T("TEXT_DOCUMENT"));
        img.id = `item-open-id-${item.id}`;
        if (item.accessRole && item.accessRole.length > 0) {
            const isEverbody = item.accessRole == "everbody";
            controls.createImg(td, undefined, 32, 32, isEverbody ? "/images/buttons/homepage.png" : "/images/buttons/family.png", isEverbody ? _T("TEXT_EVERYBODY") : _T("TEXT_FAMILY"));
            td.className = "column2-access";
        }
        td = controls.create(tr, "td");
        const a = controls.createA(td, undefined, `#open(${item.id})`, item.name);
        a.id = `item-open-id-${item.id}`;
        td = controls.create(tr, "td");
        if (isContainer(item)) {
            td.textContent = `${item.children}`;
        }
        else {
            td.textContent = utils.format_size(item.size).replace(" ", "\u00A0");
        }
    };

    const renderDocItemsTable = (filteredItems) => {
        const parent = document.getElementById("content-id");
        controls.removeAllChildren(parent);
        if (updateMarkdownItem) {
            let txtarea = controls.create(parent, "textarea");
            txtarea.id = "textarea-entry-id";
            txtarea.cols = utils.is_mobile() ? 40 : 80;
            txtarea.rows = 20;
            txtarea.addEventListener("input", () => {
                if (!markdownItemModified) {
                    markdownItemModified = true;
                    const saveButton = document.getElementById("savebutton-id");
                    saveButton.style.display = "inline";
                }
            });
            setWaitCursor(true);
            const token = utils.get_authentication_token();
            fetch(`api/document/download/${updateMarkdownItem.id}`, { headers: { "token": token } })
                .then(resp => resp.blob())
                .then(blob => blob.text())
                .then(txt => {
                    txtarea.value = txt;
                    setWaitCursor(false);
                })
                .catch((err) => renderError(err.message));
            return;
        }
        const table = controls.create(parent, "table");
        const tbody = controls.create(table, "tbody", "table-content");
        const childItems = getItems(currentId);
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
                onConfirmOverwrite(curFiles);
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
        renderDocItemsTable();
        renderTitle();
        renderActions();
    };

    const renderPageAsync = async () => {
        const parent = document.body;
        controls.removeAllChildren(parent);
        const containerDiv = controls.createDiv(parent, "container my-3");

        const h1 = controls.create(containerDiv, "h1", "mb-4", "Nachricht verschicken");

        const frm = controls.create(containerDiv, "form");
        frm.id = "form-id";
        frm.method = "post";
        frm.enctype = "multipart/formdata";
        
        const div1 = controls.createDiv(frm, "mb-3");
        const lab1 = controls.createLabel(div1, "form-label", "E-Mail-Adresse des Empf\u00E4ngers");
        lab1.setAttribute("for", "email-id");
        const inp1 = controls.createInputField(div1, "E-Mail-Adresse", undefined, "form-control", 30, 80);
        inp1.setAttribute("type", "email");
        inp1.setAttribute("aria-describedby", "emailhelp-id");
        inp1.setAttribute("id", "email-id");
        const divHelp1 = controls.createDiv(div1, "form-text");
        divHelp1.setAttribute("id", "emailhelp-id");
        divHelp1.textContent = "Die E-Mail-Adresse muss im Portal als Benutzer registriert sein und der Benutzer muss das Empfangen von Nachrichten aktiviert haben.";

        const div2 = controls.createDiv(frm, "mb-3");
        const lab2 = controls.createLabel(div2, "form-label", "Datei");
        lab2.setAttribute("for", "file-id");
        const inp2 = controls.createInputField(div2, "Datei", undefined, "form-control");
        inp2.setAttribute("type", "file");
        inp2.setAttribute("aria-describedby", "filehelp-id");
        inp2.setAttribute("id", "file-id");
        const divHelp2 = controls.createDiv(div2, "form-text");
        divHelp2.setAttribute("id", "filehelp-id");
        divHelp2.textContent = "Die Datei kann nur der Empf\u00E4nger im Portal herunterladen. Sie wird verschl\u00FCsselt auf dem Server hinterlegt und darf nicht gr\u00F6sser als 10MB sein.";

        const div3 = controls.createDiv(frm, "mb-3");
        const lab3 = controls.createLabel(div3, "form-label", "Schl\u00FCssel");
        lab3.setAttribute("for", "key-id");
        const inp3 = controls.createInputField(div3, "Schl\u00FCssel", undefined, "form-control");
        inp3.setAttribute("aria-describedby", "keyhelp-id");
        inp3.setAttribute("id", "key-id");
        inp3.setAttribute("type", "password");
        const encryptKey = await utils.get_encryption_key_async(currentUser);
        inp3.value = encryptKey;
        const divHelp3 = controls.createDiv(div3, "form-text");
        divHelp3.setAttribute("id", "keyhelp-id");
        divHelp3.textContent = "Mit diesem Schl\u00FCssel wird dein privater Schl\u00FCssel auf dem Server gesch\u00Fctzt.";

        // btnSubmit.setAttribute("type", "submit");
        // btnSubmit.setAttribute("formmethod", "POST");
        // btnSubmit.setAttribute("formenctype", "multipart/form-data");
        const cryptoKey = await utils.create_crypto_key_async(encryptKey, currentUser.passwordManagerSalt);

        const token = utils.get_authentication_token();
        const response = await fetch("api/message/privatekey", { headers: { "token": token } });
        let encodedPrivateKey = await response.json();
        if (!encodedPrivateKey) {
            const keyPair = await utils.create_rsa_keypair_async();
            const publicKey = await utils.export_public_key_async(keyPair.publicKey);
            const privateKey = await utils.export_private_key_async(keyPair.privateKey);
            encodedPrivateKey = await utils.encode_message_async(cryptoKey, privateKey);
            await fetch("api/message/keypair", {
                method: "PUT",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                body: JSON.stringify({
                    "PublicKey": publicKey,
                    "PrivateKey": encodedPrivateKey
                })
            });
        }
        // const pk = await utils.decode_message_async(cryptoKey, encodedPrivateKey);
        // console.log(pk);

        const btnSubmit = controls.createButton(frm, "Abschicken", () => {
            console.log("Send message!");
            sendMessage();
            /*
            const recipient = document.getElementById("email-id").value;
            const response = await fetch(`api/message/publickey?emailaddress=${recipient}`, { headers: { "token": token } });
            const recipientPem = await response.json();
            console.log(recipientPem);
            const recipientCryptoKey = await utils.import_public_key_async(recipientPem);
            console.log(recipientCryptoKey);
            // generate new AES key to encrypt data
            const dataCryptoKey = await utils.generate_aes_gcm_key_async();
            const expAes = await utils.export_aes_gcm_key_async(dataCryptoKey);
            console.log(expAes);
            const ciphertext = await window.crypto.subtle.encrypt(
                {
                    name: "RSA-OAEP"
                },
                recipientCryptoKey,
                new TextEncoder().encode(expAes)
            );
            console.log(ciphertext);
            const enc = await utils.encode_message_async(dataCryptoKey, "TODO");
            console.log(enc);
            */
        }, undefined, "btn btn-primary me-3");
        btnSubmit.setAttribute("type", "button");

        const btnList = controls.createButton(frm, "Meine Nachrichten", async () => {
            console.log("show meine nachrichten!");
            await downloadMessageAsync(31);
        }, undefined, "btn btn-primary");
        btnList.setAttribute("type", "button");

        // TODO: encrypt file bytes with public key of recipient (send message)
        // TODO: decrypt file bytes with private key of current user (receive message)

        // <button type="submit" class="btn btn-primary">Abschicken</button>

        // waitDiv = controls.createDiv(parent, "invisible-div");
        // await renderEncryptKeyAsync(parent);
        // controls.createDiv(parent, "currentpath").id = "currentpath-id";
        // controls.createDiv(parent, "error").id = "error-id";
        // controls.createDiv(parent, "filter").id = "filter-id";
        // controls.createDiv(parent, "content").id = "content-id";
        // controls.createDiv(parent, "title").id = "title-id";
        // controls.createDiv(parent, "action").id = "action-id";
        // renderCopyright(parent);
        //  renderUploadDocument(parent);
    };

    const render = () => {
        /*
        if (!rsaKeyPair) {
            utils.create_rsa_keypair(kp => {
                rsaKeyPair = kp;
                console.log(rsaKeyPair);
                utils.export_pkcs8_pem(rsaKeyPair.privateKey, true, pem => console.log(pem), err => console.log(err));
                utils.export_pkcs8_pem(rsaKeyPair.publicKey, false, pem => console.log(pem), err => console.log(err));
            }, err => console.log(err));
        }
        */
        cryptoKey = undefined;
        const token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/messages";
            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            async (user) => {
                currentUser = user;
                await renderPageAsync();
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
                utils.fetch_api_call(`/api/pwdman/markdown/help-documents?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
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
    };

    const onClickStart = (evt) => {
        const volume = getVolume();
        if (volume !== undefined) {
            evt.preventDefault();
            currentId = volume.parentId;
            initItems();
        }
    };

    const onClickPathItem = (evt) => {
        if (evt.target.id.startsWith("item-path-id-")) {
            const id = parseInt(evt.target.id.substr(13));
            const item = getItem(id);
            if (item !== undefined && isContainer(item)) {
                evt.preventDefault();
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
                evt.preventDefault();
                currentId = id;
                initItems();
            }
            else if (isDocument(item)) {
                evt.preventDefault();
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
        onConfirmOverwrite(curFiles);
    };

    const download = (item, blob) => {
        if (item.accessRole && item.accessRole.length > 0) {
            downloadShared(item.name, blob);
        }
        else {
            downloadEncrypted(item.name, blob);
        }
    };

    const downloadShared = (fileName, blob) => {
        const obj_url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.href = obj_url;
        a.setAttribute("download", fileName);
        a.click();
        URL.revokeObjectURL(obj_url);
        setWaitCursor(false);
    };

    const downloadEncrypted = (fileName, blob) => {
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
                                a.setAttribute("download", fileName);
                                a.click();
                                URL.revokeObjectURL(obj_url);
                                setWaitCursor(false);
                            })
                            .catch(err => {
                                console.log(err.message);
                                renderError(_T("ERROR_WRONG_KEY_DECODE_DOCUMENTS"));
                            });
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
            }
        );
    };

    const onDownloadDocument = (id) => {
        setWaitCursor(true);
        const item = getItem(id);
        const token = utils.get_authentication_token();
        fetch(`api/document/download/${id}`, { headers: { "token": token } })
            .then(resp => resp.blob())
            .then(blob => download(item, blob))
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
                (errMsg) => initItems(errMsg),
                setWaitCursor);
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
        const toolbar = document.getElementById("toolbar-id");
        controls.removeAllChildren(toolbar);
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        const label = controls.createLabel(elem, undefined, _T("LABEL_NAME"));
        label.htmlFor = "create-name-input-id";
        const name = controls.createInputField(elem, _T("TEXT_NAME"), onAddFolder, undefined, 32, 255);
        name.id = "create-name-input-id";
        controls.createSpan(elem, undefined, "  ");
        controls.createButton(elem, _T("BUTTON_CREATE"), onAddFolder);
        controls.createButton(elem, _T("BUTTON_CANCEL"), () => renderState());
        elem.scrollIntoView();
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
            const toolbar = document.getElementById("toolbar-id");
            controls.removeAllChildren(toolbar);
            const elem = document.getElementById("action-id");
            controls.removeAllChildren(elem);
            const label = controls.createLabel(elem, undefined, _T("LABEL_NAME"));
            label.htmlFor = "rename-name-input-id";
            const name = controls.createInputField(elem, _T("TEXT_NAME"), onRename, undefined, 32, 255);
            name.id = "rename-name-input-id";
            name.value = selected[0].name;
            controls.createSpan(elem, undefined, "  ");
            controls.createButton(elem, _T("BUTTON_RENAME"), onRename);
            controls.createButton(elem, _T("BUTTON_CANCEL"), () => renderState());
            elem.scrollIntoView();
            if (!utils.is_mobile()) {
                name.focus();
            }
        }
    };

    const onConfirmPublish = () => {
        const selected = getSelected();
        if (selected.length == 1) {
            const toolbar = document.getElementById("toolbar-id");
            controls.removeAllChildren(toolbar);
            const elem = document.getElementById("action-id");
            controls.removeAllChildren(elem);
            controls.createSpan(elem, undefined, _T("INFO_PUBLISH_DOCS_IN_FOLDER_FOR"));
            let priv = !selected[0].accessRole || selected[0].accessRole.length === 0;
            let fam = selected[0].accessRole === "family";
            let pub = selected[0].accessRole === "everbody";
            controls.createRadiobutton(elem, "role-private-id", "access-role", "", _T("TEXT_OWNER"), priv, onPublish);
            controls.createRadiobutton(elem, "role-family-id", "access-role", "family", _T("TEXT_FAMILY"), fam, onPublish);
            controls.createRadiobutton(elem, "role-public-id", "access-role", "everbody", _T("TEXT_EVERYBODY"), pub, onPublish);
            elem.scrollIntoView();
        }
    };

    const onPublish = (elem) => {
        const selected = getSelected();
        if (selected.length == 1 && selected[0].accessRole != elem.value) {
            const token = utils.get_authentication_token();
            utils.fetch_api_call(`api/document/folder/${selected[0].id}/accessrole`,
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(elem.value)
                },
                () => initItems(), renderError, setWaitCursor);
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

    const onEditMarkdown = () => {
        const selected = getSelected();
        if (selected && selected.length == 1) {
            updateMarkdownItem = selected[0];
            markdownItemModified = false;
            renderState();
        }
    };

    const onCancelEditMarkdown = () => {
        if (updateMarkdownItem) {
            updateMarkdownItem = undefined;
            markdownItemModified = false;
            renderState();
        }
    };

    const onUpdateMarkdown = () => {
        if (updateMarkdownItem) {
            const elem = document.getElementById("textarea-entry-id");
            const val = elem.value;
            const token = utils.get_authentication_token();
            utils.fetch_api_call(`api/document/updatemarkdown/${updateMarkdownItem.id}`,
                {
                    method: "PUT",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify(val)
                },
                () => {
                    markdownItemModified = false;
                    const saveButton = document.getElementById("savebutton-id");
                    saveButton.style.display = "none";
                }, renderError, setWaitCursor);
        }
    };

    const onConfirmDeleteDocuments = () => {
        const toolbar = document.getElementById("toolbar-id");
        controls.removeAllChildren(toolbar);
        const elem = document.getElementById("action-id");
        controls.removeAllChildren(elem);
        controls.createSpan(elem, undefined, _T("INFO_REALLY_DELETE_SELECTED_ELEMS"));
        controls.createButton(elem, _T("BUTTON_YES"), onDeleteDocuments);
        controls.createButton(elem, _T("BUTTON_NO"), () => initItems());
        elem.scrollIntoView();
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
        let filteredItems;
        if (v.length > 0) {
            const items = getItems(currentId);
            filteredItems = [];
            items.forEach(item => {
                if (item.name.toLowerCase().includes(v)) {
                    filteredItems.push(item);
                }
            });
        }
        renderDocItemsTable(filteredItems);
    };


    // new messages

    const sendMessage = () => {
        const recipient = document.getElementById("email-id").value;
        const inputFile = document.getElementById("file-id");
        if (inputFile.files.length == 1) {
            const curFile = inputFile.files[0];
            if (curFile.size < 20 * 1024 * 1024) {
                const fileReader = new FileReader();
                fileReader.onload = async (e) => await uploadMessageAsync(e.target.result, curFile, recipient);
                fileReader.readAsArrayBuffer(curFile);
            }
        }
    };

    /**
     * Initializes the user's crypto key.
     * 
     * @returns {Promise<CryptoKey> | undefined}
     */
    const initUserCryptoKeyAsync = async () => {
        if (!cryptoKey) {
            const elem = document.getElementById("input-encryptkey-id");
            if (elem && elem.value.trim().length > 0) {
                cryptoKey = await utils.create_crypto_key_async(elem.value.trim(), currentUser.passwordManagerSalt);
            }
        }
        return crypoKey;
    };

    /**
     * Returns the public RSA crypto key for a user using the user's email address.
     * 
     * @param {string} token
     * @param {string} email
     * @returns
     */
    const getPublicCryptoKeyAsync = async (token, email) => {
        const response = await fetch(`api/message/publickey?emailaddress=${email}`, { headers: { "token": token } });
        const publicKey = await response.json();
        const pem = publicKey.substring("-----BEGIN PUBLIC KEY-----".length, publicKey.length - "-----END PUBLIC KEY-----".length);
        const binary = str2ab(window.atob(pem));
        return await window.crypto.subtle.importKey("spki", binary, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);        
    };

    /**
     * Returns the decoded private RSA crypto key for the current user.
     * 
     * @param {string} token
     * @param {CryptoKey} userCryptoKey
     * @returns
     */
    const getPrivateCryptoKeyAsync = async (token, userCryptoKey) => {
        const response = await fetch("api/message/privatekey", { headers: { "token": token } });
        const encryptedPrivateKey = await response.json();
        const privateKey = await utils.decode_message_async(userCryptoKey, encryptedPrivateKey);
        const pem = privateKey.substring("-----BEGIN PRIVATE KEY-----".length, privateKey.length - "-----END PRIVATE KEY-----".length);
        const binary = str2ab(window.atob(pem));
        return await window.crypto.subtle.importKey("pkcs8", binary,
            {
                name: "RSA-OAEP",
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["decrypt"]
        );
    };

    const uploadMessageAsync = async (fileData, curFile, recipient) => {
        const token = utils.get_authentication_token();
        // fetch public key for the recipient
        const recipientCryptoKey = await getPublicCryptoKeyAsync(token, recipient);

        /*
        const response = await fetch(`api/message/publickey?emailaddress=${recipient}`, { headers: { "token": token } });
        const pem = await response.json();
        const pemContents = pem.substring("-----BEGIN PUBLIC KEY-----".length, pem.length - "-----END PUBLIC KEY-----".length);
        const binaryDerString = window.atob(pemContents);
        const binaryDer = str2ab(binaryDerString);
        const recipientCryptoKey = await window.crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"] );
        */
        // generate a symmetric key (AES, 256 bytes)
        const symmetricCryptoKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

        // encrypt the random ínitial vector and the symmetric key with the public key of the recipient
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const symmetricKeyBuffer = await window.crypto.subtle.exportKey("raw", symmetricCryptoKey);
        const symmetricKeyArray = new Uint8Array(symmetricKeyBuffer)
        const keyArray = new Uint8Array(iv.length + symmetricKeyArray.length);
        keyArray.set(iv, 0);
        keyArray.set(symmetricKeyArray, iv.length);
        const encryptedKeyBuffer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientCryptoKey, keyArray);
        const encryptedKeyArray = new Uint8Array(encryptedKeyBuffer);

        // encrypt the file data with the symmetric key
        const encryptedFileDataBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, symmetricCryptoKey, fileData);
        const encryptedFileDataArray = new Uint8Array(encryptedFileDataBuffer);

        // build cipher data array, 2 bytes for the length of the encrypted symmetric key
        const headerArray = new Uint8Array(3);
        headerArray[0] = 1; // format version
        headerArray[1] = encryptedKeyArray.length / 256;
        headerArray[2] = encryptedKeyArray.length % 256;
        const dataArray = new Uint8Array(headerArray.length + encryptedKeyArray.length + encryptedFileDataArray.length);
        dataArray.set(headerArray, 0);
        dataArray.set(encryptedKeyArray, headerArray.length)
        dataArray.set(encryptedFileDataArray, headerArray.length + encryptedKeyArray.length);

        // upload encrypted file
        const encryptedFile = new File([dataArray.buffer], curFile.name, { type: "application/octet-stream" });
        const formData = new FormData();
        formData.append("message-file", encryptedFile);
        formData.append("recipient", recipient);
        await window.fetch("api/message/upload", {
            method: "POST",
            headers: { "token": token },
            body: formData
        });
    };

    const downloadMessageAsync = async (id) => {

        const encryptKey = await utils.get_encryption_key_async(currentUser);
        const userCryptoKey = await utils.create_crypto_key_async(encryptKey, currentUser.passwordManagerSalt);

        const token = utils.get_authentication_token();

        const privateKeyCryptoKey = await getPrivateCryptoKeyAsync(token, userCryptoKey)
        /*
        const resp1 = await fetch("api/message/privatekey", { headers: { "token": token } });
        const encryptedPrivateKey = await resp1.json();
        console.log(encryptedPrivateKey);
        const privateKey = await utils.decode_message_async(cryptoKey, encryptedPrivateKey);
        console.log(privateKey);

        const pemContents = privateKey.substring("-----BEGIN PRIVATE KEY-----".length, privateKey.length - "-----END PRIVATE KEY-----".length);
        const binaryDerString = window.atob(pemContents);
        const binaryDer = str2ab(binaryDerString);
        const privateKeyCryptoKey = await window.crypto.subtle.importKey( "pkcs8", binaryDer,
            {
                name: "RSA-OAEP",
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["decrypt"]
        );
        console.log(privateKeyCryptoKey);
        */

        const resp2 = await fetch(`api/message/download/${id}`, { headers: { "token": token } });
        const blob = await resp2.blob();
        const data = new Uint8Array(blob.size);
        const reader = blob.stream().getReader();
        let idx = 0;
        while (true) {
            const readResponse = await reader.read();
            if (readResponse.done) {

                // TODO: use Uint8Array.slice to extract parts of the content

                console.log("done... decrypt everything");
                const encryptedSymmetricKeyLength = data[1] * 256 + data[2];
                const ivData = new Uint8Array(12);
                const encryptedKeyData = new Uint8Array(encryptedSymmetricKeyLength);
                for (idx = 0; idx < encryptedSymmetricKeyLength; idx++) {
                    encryptedKeyData[idx] = data[idx + 3];
                }
                const keyBuffer = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKeyCryptoKey, encryptedKeyData);
                const keyData = new Uint8Array(keyBuffer);
                console.log(keyData);
                console.log("OK!");
                for (idx = 0; idx < 12; idx++) {
                    ivData[idx] = keyData[idx];
                }
                const symmetricKeyData = new Uint8Array(keyData.length - 12);
                for (idx = 0; idx < keyData.length - 12; idx++) {
                    symmetricKeyData[idx] = keyData[idx + 12];
                }
                console.log(ivData);
                console.log(symmetricKeyData);

                const symmetricCryptoKey = await window.crypto.subtle.importKey("raw", symmetricKeyData, "AES-GCM", true, ["decrypt"]);
                console.log(symmetricCryptoKey);

                const encryptedFileData = new Uint8Array(data.length - encryptedSymmetricKeyLength - 3);
                for (idx = 0; idx < data.length - encryptedSymmetricKeyLength - 3; idx++) {
                    encryptedFileData[idx] = data[idx + 3 + encryptedSymmetricKeyLength];
                }

                const decryptedBuffer = await window.crypto.subtle.decrypt({ "name": "AES-GCM", "iv": ivData }, symmetricCryptoKey, encryptedFileData);
                console.log("Decrypted content!");
                console.log(decryptedBuffer);

                const obj_url = URL.createObjectURL(new Blob([decryptedBuffer]));
                const a = document.createElement("a");
                a.href = obj_url;
                a.setAttribute("download", `message-${id}`);
                a.click();
                URL.revokeObjectURL(obj_url);

                break;
            }
            console.log(`Read ${readResponse.value.length} bytes...`);
            readResponse.value.forEach(val => data[idx++] = val);            
        }
    };


    const str2ab = (str) => {
        const buf = new ArrayBuffer(str.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => utils.auth_lltoken(() => utils.set_locale(messages.render));

window.onclick = (event) => utils.hide_menu(event);