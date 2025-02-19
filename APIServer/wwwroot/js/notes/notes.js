var notes = (() => {

    "use strict";

    // state

    let version = "2.0.6";
    let changeDate;
    let cryptoKey;
    let currentUser;
    let selectedNoteId;
    let inSaveNote;
    let helpDiv;

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

    const encodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.encode_message(cryptoKey, text, resolve, reject), reject);
    };

    const decodeText = (text, resolve, reject) => {
        initCryptoKey(() => utils.decode_message(cryptoKey, text, resolve, reject), reject);
    };

    const encodeNote = (note, resolve, reject) => {
        let encodedNote = { "id": note.id };
        encodeText(note.title,
            (msg) => {
                encodedNote.title = msg;
                if (note.content) {
                    encodeText(note.content,
                        (content) => {
                            encodedNote.content = content;
                            resolve(encodedNote);
                        },
                        reject);
                }
                else {
                    resolve(encodedNote);
                }
            },
            reject);
    };

    const decodeNote = (note, resolve, reject) => {
        let decodedNote = { "id": note.id };
        decodeText(note.title,
            (msg) => {
                decodedNote.title = msg;
                if (note.content) {
                    decodeText(note.content,
                        (content) => {
                            decodedNote.content = content;
                            resolve(decodedNote);
                        },
                        reject);
                }
                else {
                    resolve(decodedNote);
                }
            },
            reject);
    };

    const decodeNotes = (notes, decodedNotes, resolve, reject) => {
        if (notes.length == 0) {
            resolve(decodedNotes);
            return;
        }
        let note = notes.shift();
        decodeText(note.title,
            (msg) => {
                if (note.content) {
                    decodeText(note.content,
                        (content) => {
                            decodedNotes.push({ "id": note.id, "title": msg, "content": content });
                            decodeNotes(notes, decodedNotes, resolve, reject);
                        },
                        reject);
                }
                else {
                    decodedNotes.push({ "id": note.id, "title": msg });
                    decodeNotes(notes, decodedNotes, resolve, reject);
                }
            },
            (errMsg) => {
                console.log(errMsg);
                decodedNotes.push({ "id": note.id, "title": "?" });
                decodeNotes(notes, decodedNotes, resolve, reject);
            });
    };

    // rendering

    const renderHeader = (parent, title) => {
        helpDiv = controls.createDiv(document.body);
        if (!title && currentUser) {
            title = `${currentUser.name} - ${_T("HEADER_NOTES")}`;
            const h1 = controls.create(parent, "h1", undefined, title);
            const helpImg = controls.createImg(h1, "help-button", 24, 24, "/images/buttons/help.png", _T("BUTTON_HELP"));
            helpImg.addEventListener("click", () => onUpdateHelp(true));
            if (currentUser && currentUser.photo) {
                const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
                imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
            }
        }
        else {
            controls.create(parent, "p", undefined, title);
        }
    };

    const renderCopyright = (parent) => {
        const div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `${_T("HEADER_NOTES")} ${version}. ${_T("TEXT_COPYRIGHT_YEAR")} `);
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
        controls.create(p, "p", "encryptkey-notice", _T("INFO_ENCRYPTION_NOTES"));
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

    const renderActions = (confirm) => {
        renderError("");        
        let actionDiv = document.getElementById("action-id");
        controls.removeAllChildren(actionDiv);
        if (confirm == "delete") {
            controls.create(actionDiv, "span", "confirmation", _T("INFO_REALLY_DELETE_NOTE"));
            controls.createButton(actionDiv, _T("BUTTON_YES"), () => onDeleteNote(selectedNoteId));
            controls.createButton(actionDiv, _T("BUTTON_NO"), () => renderActions("selected"));
        }
        else {
            controls.createButton(actionDiv, _T("BUTTON_CREATE_NEW_NOTE"), () => onNewNote());
            if (confirm == "selected") {
                let deleteButton = controls.createButton(actionDiv, _T("BUTTON_DELETE_NOTE"), () => renderActions("delete"));
                deleteButton.id = "action-delete-id";
            }
        }
    };

    const renderNote = (note) => {
        renderActions("selected");
        let parent = document.getElementById("content-id");
        if (!parent) {
            return;
        }
        controls.removeAllChildren(parent);
        if (selectedNoteId) {
            let noteDiv = document.getElementById(`note-id-${selectedNoteId}`);
            noteDiv.className = "note";
        }
        selectedNoteId = note ? note.id : undefined;
        if (note) {
            let noteDiv = document.getElementById(`note-id-${note.id}`);
            if (noteDiv) {
                noteDiv.className += " note-selected";
            }
            if (hasEncryptKey()) {
                let label = controls.createLabel(parent, undefined, _T("LABEL_TITLE"));
                label.htmlFor = "titel-id";
                let titleInput = controls.createInputField(parent, _T("TEXT_TITLE"), undefined, undefined, 32, 200);
                titleInput.id = "title-id";
                titleInput.addEventListener("input", () => {
                    noteDiv.textContent = titleInput.value;
                    onChangeNote();
                });
                titleInput.addEventListener("change", () => onSaveNote());
                let d = new Date(note.lastModifiedUtc);
                let caption = controls.createDiv(parent, "caption");
                let captiontxt = controls.createSpan(caption, undefined);
                captiontxt.textContent = _T("INFO_NOTE_FROM_1_2", utils.format_date(d), utils.format_time(d));
                captiontxt.id = "captiontxt-id";
                let imgStatus = controls.createImg(caption, "img-status", 24, 24, "/images/buttons/document-save-3.png", _T("INFO_STATUS_SAVING"));
                imgStatus.id = "img-status-id";
                imgStatus.style.visibility = "hidden";
                let txt = controls.create(parent, "textarea");
                txt.id = "textarea-entry-id";
                txt.rows = 8;
                txt.maxLength = 90000;
                if (!utils.is_mobile()) {
                    txt.cols = 40;
                }
                else {
                    txt.cols = 35;
                }
                txt.addEventListener("input", () => onChangeNote());
                txt.addEventListener("change", () => onSaveNote());
                decodeNote(note,
                    (decodedNote) => {
                        titleInput.value = decodedNote.title;
                        if (decodedNote.content) {
                            txt.value = decodedNote.content;
                        }
                    },
                    (errMsg) => console.error(errMsg));
            }
        }
    };

    const renderPageAsync = async (parent, notes) => {
        await renderEncryptKeyAsync(parent);
        controls.createDiv(parent, "box").id = "box-id";
        controls.createDiv(parent, "content").id = "content-id";
        controls.createDiv(parent, "error").id = "error-id";
        controls.createDiv(parent, "action").id = "action-id";
        renderCopyright(parent);
        renderNotesBox(notes);
    };

    const renderNotesBox = (notes, selectNoteId) => {
        renderError("");
        selectedNoteId = undefined;
        renderActions();
        let content = document.getElementById("content-id");
        if (content) {
            controls.removeAllChildren(content);
        }
        let boxDiv = document.getElementById("box-id");
        if (boxDiv) {
            controls.removeAllChildren(boxDiv);
            decodeNotes(notes, [],
                (decodedNotes) => {
                    decodedNotes.forEach((note) => {
                        let div = controls.createDiv(boxDiv, "note");
                        div.id = `note-id-${note.id}`;
                        div.textContent = note.title;
                        let id = note.id;
                        div.addEventListener("click", () => {
                            let token = utils.get_authentication_token();
                            utils.fetch_api_call(`api/notes/note/${id}`, { headers: { "token": token } },
                                (note) => renderNote(note),
                                (errMsg) => renderError(errMsg));
                        });
                        if (id == selectNoteId) {
                            let token = utils.get_authentication_token();
                            utils.fetch_api_call(`api/notes/note/${id}`, { headers: { "token": token } },
                                (note) => renderNote(note),
                                (errMsg) => renderError(errMsg));
                        }
                    });
                }, (errMsg) => console.log(errMsg));
        }
    };

    const render = () => {
        parent = document.body;
        controls.removeAllChildren(parent);
        changeDate = undefined;
        selectedNoteId = undefined;
        cryptoKey = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            const nexturl = "/notes";
            utils.set_window_location("/pwdman?nexturl=" + encodeURI(nexturl));
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                let nextToken = utils.get_authentication_token();
                utils.fetch_api_call("api/notes/note", { headers: { "token": nextToken } },
                    (notes) => renderPageAsync(parent, notes),
                    (errMsg) => renderError(errMsg));
            },
            (errMsg) => renderError(errMsg));
    };

    // --- callbacks

    const onUpdateHelp = (show) => {
        if (helpDiv) {
            helpDiv.className = show ? "help-div" : undefined;
            controls.removeAllChildren(helpDiv);
            if (show) {
                let contentDiv = controls.createDiv(helpDiv, "help-content");
                let mdDiv = controls.createDiv(contentDiv, "help-item");
                utils.fetch_api_call(`/api/pwdman/markdown/help-notes?locale=${utils.get_locale()}`, undefined, (html) => mdDiv.innerHTML = html);
                controls.createButton(contentDiv, _T("BUTTON_OK"), () => onUpdateHelp(false)).focus();
            }
        }
    };

    const onUpdateStatus = () => {
        let statusimg = document.getElementById("img-status-id");
        if (statusimg) {
            statusimg.style.visibility = changeDate ? "visible" : "hidden";
        }
    };

    const onChangeNote = () => {
        changeDate = Date.now();
        onUpdateStatus();
    };

    const onRefreshNotes = (selectNoteId) => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/notes/note", { headers: { "token": token } },
            (notes) => renderNotesBox(notes, selectNoteId),
            (errMsg) => renderError(errMsg));
    };

    const onNewNote = () => {
        if (!hasEncryptKey()) {
            renderError(_T("ERROR_KEY_MISSING"));
            return;
        }
        let note = { "title": _T("TEXT_NEW_NOTE") };
        encodeNote(note,
            (encodedNote) => {
                let token = utils.get_authentication_token();
                utils.fetch_api_call("api/notes/note",
                    {
                        method: "POST",
                        headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                        body: JSON.stringify(encodedNote)
                    },
                    (newNoteId) => onRefreshNotes(newNoteId),
                    (errMsg) => console.error(errMsg)
                );
            },
            (errMsg) => console.error(errMsg));
    };

    const onDeleteNote = (id) => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call(`api/notes/note/${id}`, { method: "DELETE", headers: { "token": token } },
            () => onRefreshNotes(),
            (errMsg) => console.error(errMsg)
        );
    };

    const onSaveNote = () => {
        if (inSaveNote || !changeDate) return;
        inSaveNote = true;
        changeDate = undefined;
        let titleInput = document.getElementById("title-id");
        let contentText = document.getElementById("textarea-entry-id");
        if (titleInput && contentText && selectedNoteId) {
            let note = { "id": selectedNoteId, "title": titleInput.value, "content": contentText.value };
            encodeNote(note,
                (encodedNote) => {
                    let token = utils.get_authentication_token();
                    utils.fetch_api_call("api/notes/note",
                        {
                            method: "PUT",
                            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                            body: JSON.stringify(encodedNote)
                        },
                        (lastModifiedUtc) => {
                            inSaveNote = false;
                            let captiontxt = document.getElementById("captiontxt-id");
                            if (captiontxt && lastModifiedUtc) {
                                let d = new Date(lastModifiedUtc);
                                captiontxt.textContent = _T("INFO_NOTE_FROM_1_2", utils.format_date(d), utils.format_time(d));
                            }
                            onUpdateStatus();
                        },
                        (errMsg) => {
                            console.error(errMsg);
                            inSaveNote = false;
                            onUpdateStatus();
                        }
                    );
                },
                (errMsg) => {
                    console.error(errMsg);
                    inSaveNote = false;
                    onUpdateStatus();
                });
            return;
        }
        inSaveNote = false;
        onUpdateStatus();
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
        onRefreshNotes();
    };

    const onTimer = () => {
        if (changeDate) {
            let end = Date.now();
            let elapsed = end - changeDate;
            if (elapsed > 1000) {
                onSaveNote();
            }
        }
    };

    // --- public API

    return {
        render: render,
        onTimer: onTimer
    };
})();

window.onload = () => {
    window.setInterval(notes.onTimer, 1000);
    utils.auth_lltoken(() => utils.set_locale(notes.render));
};

window.onclick = (event) => utils.hide_menu(event);