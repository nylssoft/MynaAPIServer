"use strict";

var utils = (() => {

    const concat_strings = (arr, delim) => {
        let str = "";
        let idx = 0;
        arr.forEach((a) => {
            if (a && a.length > 0) {
                if (idx > 0) {
                    str += delim;
                }
                str += a;
                idx++;
            }
        });
        return str;
    };

    const format_date = (dt) => {
        if (dt && dt.length > 0) {
            let locale = "de-DE";
            let options = { year: "numeric", month: "short", day: "numeric" };
            return new Date(dt).toLocaleDateString(locale, options);
        }
        return "";
    };

    const format_size = (cnt) => {
        if (cnt >= 1024 * 1024) {
            return `${Math.floor(cnt / (1024 * 1024))} MB`;
        }
        if (cnt >= 1024) {
            return `${Math.floor(cnt / 1024)} KB`;
        }
        return `${cnt} B`;
    };

    const shuffle_array = (arr) => {
        let ridx;
        let tmp;
        let cidx = arr.length;
        while (0 !== cidx) {
            ridx = Math.floor(Math.random() * cidx);
            cidx -= 1;
            tmp = arr[cidx];
            arr[cidx] = arr[ridx];
            arr[ridx] = tmp;
        }
        return arr;
    };

    const count_characters = (txt, charset) => {
        let cnt = 0;
        for (let idx = 0; idx < txt.length; idx++) {
            cnt += charset.includes(txt[idx]) ? 1 : 0;
        }
        return cnt;
    };

    // --- mobile support

    const is_mobile = () => {
        return window.matchMedia('(max-width: 480px)').matches;
    };

    // --- pwdman

    const get_authentication_token = () => {
        let pwdmanState;
        let str = window.sessionStorage.getItem("pwdman-state");
        if (str && str.length > 0) {
            pwdmanState = JSON.parse(str);
            if (pwdmanState && !pwdmanState.requiresPass2 && pwdmanState.token.length > 0) {
                return pwdmanState.token;
            }
        }
        return undefined;
    };

    const logout = (resolve, reject) => {
        const token = get_authentication_token();
        window.sessionStorage.removeItem("pwdman-state");
        window.localStorage.removeItem("pwdman-lltoken");
        if (token) {
            fetch_api_call("api/pwdman/logout", { headers: { "token": token } },
                (done) => console.log(`User logout: ${done}.`),
                (errMsg) => console.error(`User logout failed: ${errMsg}`));
        }
        logout_skat(resolve, reject);
    };

    const logout_skat = (resolve, reject) => {
        let skatTicket = window.sessionStorage.getItem("ticket");
        if (!skatTicket) {
            skatTicket = window.localStorage.getItem("ticket");
        }
        if (skatTicket) {
            window.sessionStorage.removeItem("ticket");
            window.localStorage.removeItem("ticket");
            fetch_api_call("api/skat/logout", { method: "POST", headers: { "ticket": skatTicket } }, resolve, reject);
        }
        else {
            if (resolve) resolve();
        }
    };

    const fetch_api_call = (apicall, init, resolve, reject, set_waitcursor, retry) => {
        if (set_waitcursor) set_waitcursor(true);
        fetch(apicall, init)
            .then(response => {
                response.json()
                    .then(json => {
                        if (response.ok) {
                            if (set_waitcursor) set_waitcursor(false);
                            if (resolve) resolve(json);
                        }
                        else {
                            if (set_waitcursor) set_waitcursor(false);
                            if (!retry && json.status == 401) {
                                let token = get_authentication_token();
                                if (token) {
                                    window.sessionStorage.removeItem("pwdman-state");
                                    if (init && init.headers && init.headers.token) {
                                        auth_lltoken(() => {
                                            let newtoken = get_authentication_token();
                                            if (newtoken && token != newtoken) {
                                                init.headers.token = newtoken;
                                                fetch_api_call(apicall, init, resolve, reject, set_waitcursor, true);
                                                return;
                                            }
                                            console.error(json);
                                            if (reject) reject(json.title);
                                        });
                                        return;
                                    }
                                }
                            }
                            console.error(json);
                            if (reject) reject(json.title);
                        }
                    })
                    .catch((err) => {
                        if (set_waitcursor) set_waitcursor(false);
                        console.error(err);
                        let errmsg = (response.status != 200) ? `${response.status} : ${response.statusText}` : err.message;
                        if (reject) reject(errmsg);
                    });
            })
            .catch(err => {
                if (set_waitcursor) set_waitcursor(false);
                console.error(err);
                if (reject) reject(err.message);
            });
    };

    const auth_lltoken = (resolve) => {
        let token = get_authentication_token();
        if (!token) {
            let lltoken = window.localStorage.getItem("pwdman-lltoken");
            if (lltoken) {
                fetch_api_call("api/pwdman/auth/lltoken", { headers: { "token": lltoken } },
                    (authResult) => {
                        let state = {
                            "token": authResult.token,
                            "userName": authResult.username,
                            "requiresPass2": authResult.requiresPass2
                        };
                        window.sessionStorage.setItem("pwdman-state", JSON.stringify(state));
                        window.localStorage.setItem("pwdman-lltoken", authResult.longLivedToken);
                        resolve();
                    },
                    (errmsg) => {
                        console.error(errmsg);
                        window.localStorage.removeItem("pwdman-lltoken");
                        resolve();
                    });
                return;
            }
        }
        resolve();
    };

    const verify_password_strength = (pwd) => {
        if (pwd.length >= 8) {
            let cntSymbols = count_characters(pwd, "!@$()=+-,:.");
            let cntUpper = count_characters(pwd, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
            let cntLower = count_characters(pwd, "abcdefghijklmnopqrstuvwxyz");
            let cntDigits = count_characters(pwd, "0123456789");
            return cntSymbols > 0 && cntUpper > 0 && cntLower > 0 && cntDigits > 0;
        }
        return false;
    };

    // --- encryption / decryption

    const hex2arr = (str) => {
        let ret = [];
        let l = str.length;
        for (let idx = 0; idx < l; idx += 2) {
            let h = str.substr(idx, 2);
            ret.push(parseInt(h, 16));
        }
        return ret;
    };

    const buf2hex = (buffer) => {
        let arr = new Uint8Array(buffer);
        return Array.prototype.map.call(arr, x => ("00" + x.toString(16)).slice(-2)).join("");
    }

    const create_crypto_key = (key, salt, resolve, reject) => {
        let encoded = new TextEncoder().encode(key);
        crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"])
            .then(key => {
                let algo = {
                    "name": "PBKDF2",
                    "hash": "SHA-256",
                    "salt": new TextEncoder().encode(salt),
                    "iterations": 1000
                };
                crypto.subtle.deriveKey(algo, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
                    .then(c => resolve(c))
                    .catch(err => reject(err.message));
            })
            .catch(err => reject(err.message));
    };

    const decode_message = (cryptoKey, msg, resolve, reject) => {
        let iv = hex2arr(msg.substr(0, 12 * 2));
        let data = hex2arr(msg.substr(12 * 2));
        let options = { name: "AES-GCM", iv: new Uint8Array(iv) };
        let cipherbuffer = new ArrayBuffer(data.length);
        let cipherarr = new Uint8Array(cipherbuffer);
        cipherarr.set(data);
        crypto.subtle.decrypt(options, cryptoKey, cipherbuffer)
            .then(decrypted => resolve(new TextDecoder().decode(decrypted)))
            .catch(err => reject(err.message));
    };

    const encode_message = (cryptoKey, msg, resolve, reject) => {
        let arr = new TextEncoder().encode(msg);
        let iv = crypto.getRandomValues(new Uint8Array(12));
        let options = { name: "AES-GCM", iv: iv };
        window.crypto.subtle.encrypt(options, cryptoKey, arr)
            .then(cipherText => resolve(buf2hex(iv) + buf2hex(cipherText)))
            .catch(err => reject(err.message));
    };

    const get_encryption_key = (user) => {
        if (user) {
            let storageKey = `diary-${user.email}-encryptkey`;
            let encryptKey = window.localStorage.getItem(storageKey);
            if (!encryptKey) {
                encryptKey = window.sessionStorage.getItem(storageKey);
            }
            if (encryptKey && encryptKey.length > 0) {
                return encryptKey;
            }
        }
        return undefined;
    };

    const set_encryption_key = (user, encryptKey) => {
        if (user) {
            let storageKey = `diary-${user.email}-encryptkey`;
            if (encryptKey && encryptKey.length > 0) {
                window.localStorage.setItem(storageKey, encryptKey);
                window.sessionStorage.setItem(storageKey, encryptKey);
            }
            else {
                window.localStorage.removeItem(storageKey);
                window.sessionStorage.removeItem(storageKey);
            }
        }
    };

    const has_viewed_encryption_key = (user) => {
        if (user) {
            let storageKey = `diary-${user.email}-viewed-encryptkey`;
            let viewed = window.localStorage.getItem(storageKey);
            if (!viewed) {
                viewed = window.sessionStorage.getItem(storageKey);
            }
            return viewed && viewed == "true";
        }
        return false;
    };

    const set_viewed_encryption_key = (user, viewed) => {
        if (user) {
            let storageKey = `diary-${user.email}-viewed-encryptkey`;
            if (viewed) {
                window.localStorage.setItem(storageKey, "true");
                window.sessionStorage.setItem(storageKey, "true");
            }
            else {
                window.localStorage.removeItem(storageKey);
                window.sessionStorage.removeItem(storageKey);
            }
        }
    };

    const generate_encryption_key = (len) => {
        let chars = "!@$()=+-,:.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let arr = new Uint32Array(len);
        window.crypto.getRandomValues(arr);
        let encryptKey = "";
        for (let i = 0; i < arr.length; i++) {
            let idx = (arr[i] % chars.length);
            encryptKey += chars[idx];
        }
        return encryptKey;
    };

    // --- drop down menu

    const create_menu = (parent) => {
        if (!parent) {
            parent = document.body;
        }        
        const dropdownDiv = controls.create(parent, "div", "dropdown");
        const dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg");
        const dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
        dropdownButton.addEventListener("click", () => document.getElementById("dropdown-id").classList.toggle("show"));
    };

    const set_menu_items = (currentUser) => {
        const parent = document.getElementById("dropdown-id");
        if (!parent) return;
        let maxheight = is_mobile() ? '(max-height: 500px)' : '(max-height: 700px)';
        const small_height = window.matchMedia(maxheight).matches;
        const very_small_height = window.matchMedia('(max-height: 400px)').matches;        
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/markdown?page=welcome", "Start");
        if (!small_height) {
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/documents", "Dokumente");
            controls.createA(parent, undefined, "/notes", "Notizen");
            controls.createA(parent, undefined, "/password", "Passw\u00F6rter");
            controls.createA(parent, undefined, "/diary", "Tagebuch");
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
            controls.createA(parent, undefined, "/skat", "Skat");
            controls.createA(parent, undefined, "/tetris", "Tetris");
        }
        if (!very_small_height) {
            controls.create(parent, "hr");
            if (currentUser) {
                controls.createA(parent, undefined, "/usermgmt", "Profil");
                controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
            }
            else {
                controls.createA(parent, undefined, "/pwdman?nexturl=/markdown", "Anmelden");
            }
        }
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (encryptKeyElem) {
            if (encryptKeyElem.classList.contains("show")) {
                controls.createA(parent, undefined, "/hidekey", "Schl\u00FCssel verbergen",
                    () => {
                        set_viewed_encryption_key(currentUser, true);
                        show_encrypt_key(currentUser, false);
                    });
            }
            else {
                controls.createA(parent, undefined, "/showkey", "Schl\u00FCssel anzeigen",
                    () => show_encrypt_key(currentUser, true));
            }
        }
    };

    const show_encrypt_key = (currentUser, show) => {
        const encryptKeyElem = document.getElementById("div-encryptkey-id");
        if (!encryptKeyElem) return;
        if (show || !has_viewed_encryption_key(currentUser)) {
            encryptKeyElem.classList.add("show");
        }
        else {
            encryptKeyElem.classList.remove("show");
        }
        set_menu_items(currentUser);
    };

    const hide_menu = (event) => {
        if (!event.target.matches(".dropbtn")) {
            const dropdowns = document.getElementsByClassName("dropdown-content");
            if (dropdowns) {
                for (let i = 0; i < dropdowns.length; i++) {
                    let openDropdown = dropdowns[i];
                    if (openDropdown.classList.contains("show")) {
                        openDropdown.classList.remove("show");
                    }
                }
            }
        }
    };

    const is_menu_hidden = () => {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        if (dropdowns) {
            for (let i = 0; i < dropdowns.length; i++) {
                let openDropdown = dropdowns[i];
                if (openDropdown.classList.contains("show")) {
                    return false;
                }
            }
        }
        return true;
    };

    // --- public API

    return {
        concat_strings: concat_strings,
        format_date: format_date,
        format_size: format_size,
        shuffle_array: shuffle_array,
        count_characters: count_characters,
        get_authentication_token: get_authentication_token,
        logout: logout,
        logout_skat: logout_skat,
        fetch_api_call: fetch_api_call,
        is_mobile: is_mobile,
        auth_lltoken: auth_lltoken,
        verify_password_strength,
        hex2arr: hex2arr,
        buf2hex: buf2hex,
        create_crypto_key: create_crypto_key,
        decode_message: decode_message,
        encode_message: encode_message,
        get_encryption_key: get_encryption_key,
        set_encryption_key: set_encryption_key,
        has_viewed_encryption_key: has_viewed_encryption_key,
        set_viewed_encryption_key: set_viewed_encryption_key,
        generate_encryption_key: generate_encryption_key,
        create_menu: create_menu,
        set_menu_items: set_menu_items,
        show_encrypt_key: show_encrypt_key,
        hide_menu: hide_menu,
        is_menu_hidden: is_menu_hidden
    };
})();
