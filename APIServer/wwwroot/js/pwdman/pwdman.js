"use strict";

var pwdman = (() => {

    // UI elements

    let userPasswordPwd;
    let userNameInput;
    let secretKeyPwd;
    let oldPasswordPwd;
    let newPasswordPwd;
    let confirmPasswordPwd;

    // state

    let userName;
    let token;
    let salt
    let cryptoKey;
    let changePwd;

    let version = "1.0.0";

    // helper

    const hex2arr = (str) => {
        let ret = [];
        let l = str.length;
        for (let idx = 0; idx < l; idx += 2) {
            let h = str.substr(idx, 2);
            ret.push(parseInt(h, 16));
        }
        return ret;
    };

    const authenticate = () => {
        fetch("api/pwdman/auth", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ "username": userNameInput.value, "password": userPasswordPwd.value })
        })
            .then(response => response.json())
            .then((t) => {
                if (t && t.length > 0) {
                    userName = userNameInput.value;
                    token = t;
                    localStorage.setItem("pwdmantoken", token);
                    localStorage.setItem("pwdmanusername", userName);
                }
                render();
            })
            .catch((err) => console.error(err));
    };

    const setCryptoKey = () => {
        let encoded = new TextEncoder().encode(secretKeyPwd.value);
        crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then((key) => {
                let algo = {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt: new TextEncoder().encode(salt),
                    iterations: 1000
                };
                crypto.subtle.deriveKey(algo, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then((c) => {
                        cryptoKey = c;
                        render();
                    });
            });
    };

    const decodePassword = async (encodedPwd) => {
        let iv = hex2arr(encodedPwd.substr(0, 12 * 2));
        let data = hex2arr(encodedPwd.substr(12 * 2));
        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        let cipherbuffer = new ArrayBuffer(data.length);
        let cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        let decrypted = await crypto.subtle.decrypt(options, cryptoKey, cipherbuffer);
        return new TextDecoder().decode(decrypted);
    };

    // rendering

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", `Myna Online Password Manager ${version}. Copyright 2020 `);
        let a = controls.createA(div, "copyright", "https://github.com/nylssoft/", "Niels Stockfleth");
        a.target = "_blank";
        controls.create(div, "span", "copyright", `. Alle Rechte vorbehalten.`);
        if (token) {
            controls.createButton(div, "Abmelden", btnLogout_click, "Logout", "small-button");
        }
        if (token && !changePwd) {
            controls.createButton(div, "Kennwort \u00E4ndern", btnChangePwd_click, "ChangePwd", "small-button");
        }
    };

    const renderHeader = (parent, txt) => {
        controls.create(parent, "h1", undefined, "Passw\u00F6rter");
        if (userName && userName.length > 0) {
            controls.create(parent, "p", undefined, `Hallo ${userName}! ${txt}`);
        }
        else {
            controls.create(parent, "p", undefined, txt);
        }
    };

    const renderAuthentication = (parent) => {
        renderHeader(parent, "Melde Dich mit Benutzernamen und Passwort an.");
        let div = controls.createDiv(parent, "logindiv");
        controls.createLabel(div, undefined, "Benutzer:");
        userNameInput = controls.createInputField(div, "Benutzer", () => userPasswordPwd.focus(), undefined, 16, 100);
        controls.createLabel(div, undefined, "Kennwort:");
        userPasswordPwd = controls.createPasswordField(div, "Kennwort", authenticate, undefined, 16, 100);
        userNameInput.focus();
        renderCopyright(parent);
    };

    const renderChangePwd = (parent) => {
        renderHeader(parent, "Gibt Dein altes und neues Kennwort ein.");
        let oldpwddiv = controls.createDiv(parent);
        controls.createLabel(oldpwddiv, undefined, "Altes Kennwort:");
        oldPasswordPwd = controls.createPasswordField(oldpwddiv, "Altes Kennwort", () => newPasswordPwd.focus(), undefined, 16, 100);
        oldPasswordPwd.focus();
        let newpwddiv = controls.createDiv(parent);
        controls.createLabel(newpwddiv, undefined, "Neues Kennwort:");
        newPasswordPwd = controls.createPasswordField(newpwddiv, "Neues Kennwort", () => confirmPasswordPwd.focus(), undefined, 16, 100);
        let confirmpwddiv = controls.createDiv(parent);
        controls.createLabel(confirmpwddiv, undefined, "Best\u00E4tiges Kennwort:");
        confirmPasswordPwd = controls.createPasswordField(confirmpwddiv, "Best\u00E4tiges Kennwort", () => { }, undefined, 16, 100);
        let okcanceldiv = controls.createDiv(parent);
        controls.createButton(okcanceldiv, "OK",
            () => {
                if (newPasswordPwd.value.length == 0 ||
                    newPasswordPwd.value != confirmPasswordPwd.value ||
                    newPasswordPwd.value == oldPasswordPwd.value) {
                    return;
                }
                fetch("api/pwdman/userpwd", {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "oldpassword": oldPasswordPwd.value, "newpassword": newPasswordPwd.value})
                })
                    .then(response => response.json())
                    .then((ok) => {
                        if (ok) {
                            changePwd = false;
                            render();
                        }
                    })
                    .catch((err) => console.error(err));                
            }, "ok", "button");
        controls.createButton(okcanceldiv, "Abbrechen",
            () => {
                changePwd = false;
                render();
            }, "cancel", "button");
        renderCopyright(parent);
    };

    const renderSecretKey = (parent) => {
        renderHeader(parent, "Gibt den Schl\u00FCssel zum Dekodieren der Passwortdatei ein.");
        let div = controls.createDiv(parent, "secretkeydiv");
        controls.createLabel(div, undefined, "Geheimer Schl\u00FCssel:");
        secretKeyPwd = controls.createPasswordField(div, "Geheimer Schluessel", setCryptoKey, undefined, 16, 100);
        secretKeyPwd.focus();
        renderCopyright(parent);
    };

    const renderPasswordItem = (parent, txt, decode) => {
        let imgshow = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/document-decrypt-3.png");
        imgshow.title = "Anzeigen";
        let imgcopy = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/edit-copy-6.png");
        imgcopy.title = "In die Zwischenablage kopieren";
        let span = controls.create(parent, "span", "pwditem");
        imgcopy.addEventListener("click", async () => {
            let t = txt;
            if (decode) {
                t = await decodePassword(txt);
            }
            navigator.clipboard.writeText(t);
        });
        imgshow.addEventListener("click", async () => {
            let hide = span.textContent.length > 0;
            if (hide) {
                span.textContent = "";
                imgshow.title = "Anzeigen";
                imgshow.src = "/images/pwdman/document-decrypt-3.png";
            }
            else {
                let t = txt;
                if (decode) {
                    t = await decodePassword(txt);
                }
                span.textContent = t;
                imgshow.title = "Verbergen";
                imgshow.src = "/images/pwdman/document-encrypt-3.png";
            }
        });
    };

    const renderPasswordItems = (parent, pwdItems) => {
        renderHeader(parent, "Folgende Passw\u00F6rter stehen zur Verf\u00FCgung:");
        let div = controls.createDiv(parent, "pwditemsdiv");
        let table = controls.create(div, "table");
        let thead = controls.create(table, "thead");
        let thr = controls.create(thead, "tr");
        controls.create(thr, "th", undefined, "Name");
        controls.create(thr, "th", undefined, "Website");
        controls.create(thr, "th", undefined, "Benutzer");
        controls.create(thr, "th", undefined, "Passwort");
        controls.create(thr, "th", undefined, "Beschreibung");
        let tbody = controls.create(table, "tbody");
        pwdItems.forEach(pwdItem => {
            let tr = controls.create(tbody, "tr");
            controls.create(tr, "td", undefined, pwdItem.Name);
            let tdwebsite = controls.create(tr, "td");
            let imgopen = controls.createImg(tdwebsite, undefined, 32, 32, "/images/pwdman/homepage.png");
            imgopen.title = pwdItem.Url;
            imgopen.addEventListener("click", () => {
                window.open(pwdItem.Url);
            });
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Login);
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Password, true);
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Description);
        });
        renderCopyright(parent);
    };

    const render = () => {
        controls.removeAllChildren(document.body);
        if (!token || token.length == 0) {
            token = localStorage.getItem("pwdmantoken");
            userName = localStorage.getItem("pwdmanusername");
        }
        if (!token || token.length == 0) {
            renderAuthentication(document.body);
        }
        else if (changePwd) {
            renderChangePwd(document.body);
        }
        else if (cryptoKey === undefined) {
            fetch("api/pwdman/salt", { headers: { "token": token } })
                .then(response => response.json())
                .then(s => {
                    if (s && s.length > 0) {
                        salt = s;
                        renderSecretKey(document.body, salt);
                    }
                    else {
                        btnLogout_click();
                    }
                })
                .catch((err) => {
                    console.error(err);
                    btnLogout_click();
                });
        }
        else {
            fetch("api/pwdman/file", { headers: { "token": token } })
                .then(response => response.json())
                .then(datastr => {
                    if (datastr && datastr.length > 0) {
                        let iv = hex2arr(datastr.substr(0, 12 * 2));
                        let data = hex2arr(datastr.substr(12 * 2));
                        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
                        let cipherbuffer = new ArrayBuffer(data.length);
                        let cipherarr = new Uint8Array(cipherbuffer);
                        cipherarr.set(data);
                        crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
                            .then((decrypted) => {
                                let str = new TextDecoder().decode(decrypted);
                                let pwdItems = JSON.parse(str);
                                renderPasswordItems(document.body, pwdItems);
                            })
                            .catch((err) => {
                                console.error(err);
                                btnLogout_click();
                            });
                    }
                    else {
                        btnLogout_click();
                    }
                })
                .catch((err) => console.error(err));
        }
    };

    // callbacks

    const btnLogout_click = () => {
        localStorage.removeItem("pwdmantoken");
        localStorage.removeItem("pwdmanusername");
        token = undefined;
        cryptoKey = undefined;
        userName = undefined;
        changePwd = false;
        render();
    };

    const btnChangePwd_click = () => {
        changePwd = true;
        render();
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    pwdman.render();
};
