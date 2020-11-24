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
        window.sessionStorage.removeItem("pwdman-state");
        window.localStorage.removeItem("pwdman-lltoken");
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

    const fetch_api_call = (apicall, init, resolve, reject, set_waitcursor) => {
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
                            console.error(json.title);
                            if (reject) reject(json.title);
                        }
                    })
                    .catch((err) => {
                        if (set_waitcursor) set_waitcursor(false);
                        console.error(err.message);
                        let errmsg = (response.status != 200) ? `${response.status} : ${response.statusText}` : err.message;
                        if (reject) reject(errmsg);
                    });
            })
            .catch(err => {
                if (set_waitcursor) set_waitcursor(false);
                console.error(err.message);
                if (reject) reject(err.message);
            });
    };

    const auth_lltoken = (resolve) => {
        let token = utils.get_authentication_token();
        if (!token) {
            let lltoken = window.localStorage.getItem("pwdman-lltoken");
            if (lltoken) {
                utils.fetch_api_call("api/pwdman/auth/lltoken", { headers: { "token": lltoken } },
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

    // --- public API

    return {
        concat_strings: concat_strings,
        format_date: format_date,
        shuffle_array: shuffle_array,
        get_authentication_token: get_authentication_token,
        logout: logout,
        logout_skat: logout_skat,
        fetch_api_call: fetch_api_call,
        is_mobile: is_mobile,
        auth_lltoken: auth_lltoken
    };
})();
