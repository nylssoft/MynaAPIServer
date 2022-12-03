"use strict";

var markdown = (() => {

    let currentUser;
    let page;
    let hideCookieBanner;

    const renderPage = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        if (!hideCookieBanner) {
            utils.create_cookies_banner(parent);
        }
        utils.create_menu(parent);
        if (currentUser && currentUser.photo) {
            const imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("HEADER_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
        let div = controls.createDiv(parent);
        let opt = undefined;
        const token = utils.get_authentication_token();
        if (token) {
            opt = { headers: { "token": token } };
        }
        utils.fetch_api_call(`/api/pwdman/markdown/${page}?locale=${utils.get_locale()}`, opt,
            (html) => {
                setMarkdownHTML(div, html);
                const h1 = document.querySelector("h1");
                if (h1) {
                    document.title = h1.textContent;
                    if (currentUser && currentUser.name) {
                        h1.textContent = `${currentUser.name} - ` + h1.textContent;
                    }
                }
            });
        utils.set_menu_items(currentUser);
    };

    const setMarkdownHTML = (div, html) => {
        let pattern = "$backbutton";
        let sidx = html.indexOf(pattern);
        let backButton = false;
        if (sidx >= 0) {
            html = html.substring(0, sidx) + html.substring(sidx + pattern.length);
            backButton = true;
        }
        pattern = "$background(";
        sidx = html.indexOf(pattern);
        if (sidx >= 0) {
            const eidx = html.indexOf(")", sidx + pattern.length + 1);
            if (eidx > sidx) {
                const url = html.substring(sidx + pattern.length + 1, eidx);
                const prefix = html.substring(0, sidx);
                const suffix = html.substring(eidx + 1);
                const nonce = document.body.getAttribute("markdown-nonce");
                html = `${prefix}<style nonce="${nonce}">body { background-image: url(${url}) }</style>\n${suffix}`;
            }
        }
        while (true) {
            const startPattern = "$role-begin(";
            const sidx1 = html.indexOf(startPattern);
            if (sidx1 < 0) break;
            const eidx1 = html.indexOf(")", sidx1 + startPattern.length + 1);
            if (eidx1 < 0) {
                console.error("Missing closing bracket for $role-begin");
                break;
            }
            const endPattern = "$role-end";
            const sidx2 = html.indexOf(endPattern, eidx1 + 1);
            if (sidx2 < 0) {
                console.error("Missing $role-end");
                break;
            }
            const role = html.substring(sidx1 + pattern.length, eidx1);
            const prefix = html.substring(0, sidx1);
            const suffix = html.substring(sidx2 + endPattern.length);
            let content = "";
            if (currentUser && currentUser.roles && currentUser.roles.includes(role)) {
                content = html.substring(eidx1 + 1, sidx2);
            }
            html = prefix + content + suffix;
        }
        div.innerHTML = html;
        if (backButton && history.length > 1) {
            controls.createButton(div, _T("BUTTON_BACK"), () => history.back());
        }
    };

    const render = () => {
        currentUser = undefined;
        const token = utils.get_authentication_token();
        if (!token) {
            renderPage();
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPage();
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                renderPage();
            });
    };

    const init = () => {
        const urlParams = new URLSearchParams(window.location.search);
        hideCookieBanner = urlParams.has("hidecookiebanner");
        page = urlParams.get("page") || "startpage";
        utils.set_locale(render, urlParams.get("locale"));
    };

    return {
        init: init
    };
})();

window.onload = () => utils.auth_lltoken(markdown.init);

window.onclick = (event) => utils.hide_menu(event);