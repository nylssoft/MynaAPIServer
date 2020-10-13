"use strict";

var pwdman = (() => {

    // UI elements

    let userPasswordPwd;
    let userNameInput;
    let codeInput;
    let filterInput;
    let secretKeyPwd;
    let oldPasswordPwd;
    let newPasswordPwd;
    let confirmPasswordPwd;
    let errorDiv;
    let pwdItemsDiv;

    // state

    let userName;
    let token;
    let requiresPass2;
    let salt
    let cryptoKey;
    let changePwd;
    let lastErrorMessage;

    let version = "1.0.2";

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

    const getHostFromUrl = (urlstr) => {
        urlstr = urlstr.toLowerCase();
        if (!urlstr.startsWith("http:") && !urlstr.startsWith("https:")) {
            urlstr = `https://${urlstr}`;
        }
        return new URL(urlstr).host;
    };

    const getState = () => {
        let ret;
        let str = localStorage.getItem("pwdman-state");
        if (str && str.length > 0) {
            ret = JSON.parse(str);
        }
        return ret;
    };

    const setState = (state) => {
        if (state) {
            localStorage.setItem("pwdman-state", JSON.stringify(state));
        }
        else {
            localStorage.removeItem("pwdman-state");
        }
    };

    const reset = (errmsg) => {
        setState();
        token = undefined;
        cryptoKey = undefined;
        userName = undefined;
        changePwd = false;
        lastErrorMessage = "";
        if (errmsg) {
            lastErrorMessage = errmsg;
        }
        render();
    };

    const authenticate = () => {
        lastErrorMessage = "";
        fetch("api/pwdman/auth", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ "username": userNameInput.value, "password": userPasswordPwd.value })
        })
            .then(response => {
                if (response.ok) {
                    response.json().then(authResult => {
                        userName = userNameInput.value;
                        token = authResult.token;
                        requiresPass2 = authResult.requiresPass2;
                        setState({ "token": token, "userName": userName, "requiresPass2": requiresPass2 });
                        render();
                    });
                }
                else {
                    response.json().then(apierr => {
                        lastErrorMessage = apierr.title;
                        render();
                    })
                }
            })            
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const authenticatePass2 = () => {
        lastErrorMessage = "";
        fetch("api/pwdman/auth2", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
            body: JSON.stringify(codeInput.value)
        })
            .then(response => {
                if (response.ok) {
                    response.json().then(t => {
                        token = t;
                        requiresPass2 = false;
                        let state = getState();
                        state.token = token;
                        state.requiresPass2 = requiresPass2;
                        setState(state);
                        render();
                    });
                }
                else {
                    response.json().then(apierr => {
                        lastErrorMessage = apierr.title;
                        render();
                    })
                }
            })
            .catch(err => {
                lastErrorMessage = err.message;
                render();
            });
    };

    const setCryptoKey = () => {
        let encoded = new TextEncoder().encode(secretKeyPwd.value);
        crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then(key => {
                let algo = {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt: new TextEncoder().encode(salt),
                    iterations: 1000
                };
                crypto.subtle.deriveKey(algo, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then(c => {
                        cryptoKey = c;
                        render();
                    })
                    .catch(err => console.error(err));
            })
            .catch(err => console.error(err));
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
        errorDiv = controls.createDiv(parent, "error");
        if (lastErrorMessage) {
            errorDiv.textContent = lastErrorMessage;
        }
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
        let header = "Passw\u00F6rter";
        if (userName && userName.length > 0) {
            header += ` f\u00FCr ${userName}`;
        }
        controls.create(parent, "h1", undefined, header);
        controls.create(parent, "p", undefined, txt);
    };

    const renderAuthentication = (parent) => {
        renderHeader(parent, "Melde Dich mit Benutzernamen und Passwort an.");
        let div = controls.createDiv(parent, "logindiv");
        controls.createLabel(div, undefined, "Benutzer:");
        userNameInput = controls.createInputField(div, "Benutzer", () => userPasswordPwd.focus(), undefined, 16, 100);
        controls.createLabel(div, undefined, "Kennwort:");
        userPasswordPwd = controls.createPasswordField(div, "Kennwort", authenticate, undefined, 16, 100);
        userNameInput.focus();
        controls.createButton(div, "Anmelden", authenticate, "login", "button");
        renderCopyright(parent);
    };

    const renderPass2 = (parent) => {
        renderHeader(parent, "Gibt den Best\u00E4tigungscode ein.");
        let div = controls.createDiv(parent, "codediv");
        controls.createLabel(div, undefined, "Best\u00E4tigungscode:");
        codeInput = controls.createInputField(div, "Best\u00E4tigungscode", authenticatePass2, undefined, 10, 10);
        codeInput.focus();
        controls.createButton(div, "Best\u00E4tigen", authenticatePass2, "confirmtotp", "button");
        controls.createButton(div, "Neuen Code anfordern",
            () => {
                lastErrorMessage = "";
                fetch("api/pwdman/totp", {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token }
                })
                    .then(response => {
                        if (response.ok) {
                            render();
                        }
                        else {
                            response.json().then(apierror => {
                                lastErrorMessage = apierror.title;
                                render();
                            });
                        }
                    })
                    .catch(err => {
                        lastErrorMessage = err.message;
                        render();
                    });
            }, "sendtotp", "button");
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
                if (newPasswordPwd.value != confirmPasswordPwd.value) {
                    errorDiv.textContent = "Die Best\u00E4tigung passt nicht mit dem Kennwort \u00FCberein.";
                    return;
                }
                lastErrorMessage = "";
                fetch("api/pwdman/userpwd", {
                    method: "POST",
                    headers: { "Accept": "application/json", "Content-Type": "application/json", "token": token },
                    body: JSON.stringify({ "oldpassword": oldPasswordPwd.value, "newpassword": newPasswordPwd.value})
                })
                    .then(response => {
                        if (response.ok) {
                            changePwd = false;
                            render();
                        }
                        else {
                            response.json().then(apierror => {
                                lastErrorMessage = apierror.title;
                                render();
                            });
                        }
                    })
                    .catch(err => {
                        lastErrorMessage = err.message;
                        render();
                    });
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
        secretKeyPwd = controls.createPasswordField(div, "Geheimer Schluessel", setCryptoKey, undefined, 32, 100);
        secretKeyPwd.focus();
        controls.createButton(div, "Dekodieren", setCryptoKey, "decode", "button");
        renderCopyright(parent);
    };

    const renderPasswordItem = (parent, txt, desc, decode) => {
        if (txt.length == 0) return;
        let imgshow = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/document-decrypt-3.png");
        imgshow.title = `${desc} anzeigen`;
        let imgcopy = controls.createImg(parent, undefined, 32, 32, "/images/pwdman/edit-copy-6.png");
        imgcopy.title = `${desc} in die Zwischenablage kopieren`;
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
                imgshow.title = `${desc} anzeigen`;
                imgshow.src = "/images/pwdman/document-decrypt-3.png";
            }
            else {
                let t = txt;
                if (decode) {
                    t = await decodePassword(txt);
                }
                span.textContent = t;
                imgshow.title = `${desc} verbergen`;
                imgshow.src = "/images/pwdman/document-encrypt-3.png";
            }
        });
    };
    
    const renderPasswordTable = (parent, pwdItems) => {
        controls.removeAllChildren(parent);
        let table = controls.create(parent, "table");
        let thead = controls.create(table, "thead");
        let thr = controls.create(thead, "tr");
        controls.create(thr, "th", undefined, "Name");
        controls.create(thr, "th", undefined, "Login");
        controls.create(thr, "th", undefined, "Passwort");
        controls.create(thr, "th", undefined, "Beschreibung");
        let tbody = controls.create(table, "tbody");
        pwdItems.forEach(pwdItem => {
            let tr = controls.create(tbody, "tr");
            let tdname = controls.create(tr, "td");
            if (pwdItem.Url.length > 0) {
                let host = getHostFromUrl(pwdItem.Url);
                controls.createImg(tdname, "favicon", 16, 16, `https://www.google.com/s2/favicons?domain=${host}`);
                let url = pwdItem.Url;
                if (url.indexOf(":") == -1) {
                    url = `https://${url}`;
                }
                controls.createA(tdname, undefined, url, pwdItem.Name,
                    () => window.open(url, "_blank", "noopener=yes,noreferrer=yes"));
            }
            else {
                controls.create(tdname, "span", undefined, pwdItem.Name);
            }
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Login, "Login");
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Password, "Passwort", true);
            renderPasswordItem(controls.create(tr, "td"), pwdItem.Description, "Beschreibung");
        });
    };

    const renderPasswordItems = (parent, pwdItems) => {
        renderHeader(parent, "Folgende Passw\u00F6rter stehen zur Verf\u00FCgung:");
        let div = controls.createDiv(parent);
        controls.createLabel(div, undefined, "Filter:");
        filterInput = controls.createInputField(div, "Filter", () => {
            let v = filterInput.value.toLowerCase();
            if (v.length > 0) {
                let filteredItems = [];
                pwdItems.forEach(pwdItem => {
                    if (pwdItem.Name.toLowerCase().startsWith(v)) {
                        filteredItems.push(pwdItem);
                    }
                });
                renderPasswordTable(pwdItemsDiv, filteredItems);
            }
            else {
                renderPasswordTable(pwdItemsDiv, pwdItems);
            }
        }, undefined, 32, 100);
        filterInput.focus();
        pwdItemsDiv = controls.createDiv(parent, "pwditemsdiv");        
        renderPasswordTable(pwdItemsDiv, pwdItems);
        renderCopyright(parent);
    };

    const render = () => {
        controls.removeAllChildren(document.body);
        let state = getState();
        if (state) {
            if (requiresPass2 == undefined) {
                requiresPass2 = state.requiresPass2;
            }
            if (!token || token.length == 0) {
                token = state.token;
                userName = state.userName;
            }
        }
        if (!token || token.length == 0) {
            renderAuthentication(document.body);
        }
        else if (requiresPass2 == true) {
            renderPass2(document.body);
        }
        else if (changePwd) {
            renderChangePwd(document.body);
        }
        else if (cryptoKey === undefined) {
            fetch("api/pwdman/salt", { headers: { "token": token } })
                .then(response => {
                    if (response.ok) {
                        response.json().then(s => {
                            salt = s;
                            renderSecretKey(document.body, salt);
                        });
                    }
                    else {
                        response.json().then(apierr => reset(apierr.title));
                    }
                })
                .catch(err => reset(err.message));
        }
        else {
            lastErrorMessage = "";
            fetch("api/pwdman/file", { headers: { "token": token } })
                .then(response => {
                    if (response.ok) {
                        response.json().then(datastr => {
                            let iv = hex2arr(datastr.substr(0, 12 * 2));
                            let data = hex2arr(datastr.substr(12 * 2));
                            let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
                            let cipherbuffer = new ArrayBuffer(data.length);
                            let cipherarr = new Uint8Array(cipherbuffer);
                            cipherarr.set(data);
                            crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
                                .then(decrypted => {
                                    let str = new TextDecoder().decode(decrypted);
                                    let pwdItems = JSON.parse(str);
                                    pwdItems.sort((a, b) => a.Name.localeCompare(b.Name));
                                    renderPasswordItems(document.body, pwdItems);
                                })
                                .catch(() => {
                                    lastErrorMessage = "Die Passwortdatei kann nicht entschl\u00FCsselt werden.";
                                    cryptoKey = undefined;
                                    render();
                                });
                        });
                    }
                    else {
                        response.json().then(apierr => reset(apierr.title));
                    }
                })
                .catch(err => reset(err.message));
        }
    };

    // callbacks

    const btnLogout_click = () => {
        reset();
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
