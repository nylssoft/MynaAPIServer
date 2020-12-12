"use strict";

var notes = (() => {

    // state

    let version = "1.0.3";
    let changeDate;
    let cryptoKey;
    let currentUser;
    let selectedNoteId;
    let inSaveNote;

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

    const showEncryptKey = (show) => {
        let elem = document.getElementById("div-encryptkey-id");
        elem.style.display = show ? "" : "none";
    };

    // rendering

    const renderHeader = (parent, intro) => {
        controls.create(parent, "h1", undefined, "Notizen");
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
            img.addEventListener("click", () => window.location.href = "/usermgmt?nexturl=" + encodeURI(window.location.href));
        }
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Notes ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten. `);
        controls.createA(div, "copyright", "/slideshow", "Home");
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
        let encryptKey = utils.get_encryption_key(currentUser);
        renderHeader(parent);
        let p = controls.create(parent, "p");
        let elem = controls.createCheckbox(p, "checkbox-show-encryptkey-id", undefined,
            "Schl\u00FCssel anzeigen", encryptKey == undefined,
            () => onSelectShowEncryptKey());
        let div = controls.createDiv(parent);
        div.id = "div-encryptkey-id";
        p = controls.create(div, "p");
        p.id = "p-encryptkey-notice-id";
        controls.create(p, "p", undefined,
            "Die Notizen werden auf dem Server verschl\u00FCsselt gespeichert, sodass nur Du die Notizen lesen kannst." +
            " Dazu ist ein Schl\u00FCssel erforderlich, der in Deinem Browser lokal gespeichert werden kann." +
            " Notiere den Schl\u00FCssel, z.B. in einem Passwort-Manager.");
        p = controls.create(div, "p");
        elem = controls.createLabel(p, undefined, "Schl\u00FCssel:");
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
    };

    const renderActions = (confirm) => {
        renderError("");        
        let actionDiv = document.getElementById("action-id");
        controls.removeAllChildren(actionDiv);
        if (confirm == "delete") {
            controls.create(actionDiv, "span", "confirmation", "Willst Du die Notiz wirklich l\u00F6schen? ");
            controls.createButton(actionDiv, "Ja", () => onDeleteNote(selectedNoteId));
            controls.createButton(actionDiv, "Nein", () => renderActions("selected"));
        }
        else {
            controls.createButton(actionDiv, "Neue Notiz anlegen", () => onNewNote());
            if (confirm == "selected") {
                let deleteButton = controls.createButton(actionDiv, "Notiz l\u00F6schen", () => renderActions("delete"));
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
                let label = controls.createLabel(parent, undefined, "Titel:");
                label.htmlFor = "titel-id";
                let titleInput = controls.createInputField(parent, "Titel", undefined, undefined, 32, 255);
                titleInput.id = "title-id";
                titleInput.addEventListener("input", () => {
                    noteDiv.textContent = titleInput.value;
                    onChangeNote();
                });
                titleInput.addEventListener("change", () => onSaveNote());
                let d = new Date(note.lastModifiedUtc);
                let caption = controls.createDiv(parent, "caption");
                caption.textContent = `Notiz vom ${d.toLocaleDateString("de-DE")} ${d.toLocaleTimeString("de-DE")}`;
                let imgStatus = controls.createImg(caption, "img-status", 24, 24);
                imgStatus.id = "img-status-id";
                imgStatus.style.visibility = "hidden";
                let txt = controls.create(parent, "textarea");
                txt.id = "textarea-entry-id";
                txt.rows = 8;
                txt.spellcheck = false;
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

    const renderPage = (parent, notes) => {
        renderEncryptKey(parent);
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
            let nexturl = "/notes";
            window.location.href = "/pwdman?nexturl=" + encodeURI(nexturl);
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                let nextToken = utils.get_authentication_token();
                utils.fetch_api_call("api/notes/note", { headers: { "token": nextToken } },
                    (notes) => renderPage(parent, notes),
                    (errMsg) => renderError(errMsg));
            },
            (errMsg) => renderError(errMsg));
    };

    // --- callbacks

    const onUpdateStatus = () => {
        let statusimg = document.getElementById("img-status-id");
        if (statusimg) {
            if (!changeDate) {
                statusimg.style.visibility = "hidden";
            }
            else {
                statusimg.src = "/images/notes/document-save-3.png";
                statusimg.title = "\u00C4nderung wird gespeichert...";
                statusimg.style.visibility = "visible";
            }
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
            renderError("Der Schl\u00FCssel fehlt.");
            return;
        }
        let note = { "title": "Neue Notiz" };
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
                        () => {
                            inSaveNote = false;
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

    const onSelectShowEncryptKey = () => {
        let elem = document.getElementById("checkbox-show-encryptkey-id");
        showEncryptKey(elem.checked);
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
    }

    // --- public API

    return {
        render: render,
        onTimer: onTimer
    };
})();

window.onload = () => {
    window.setInterval(notes.onTimer, 1000);
    utils.auth_lltoken(notes.render);
};