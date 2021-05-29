"use strict";

var markdown = (() => {

    let currentUser;
    let page;

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/buttons/hamburger.svg");
        dropdownButton.addEventListener("click", () => {
            document.getElementById("dropdown-id").classList.toggle("show");
        });
        let dropdownContentDiv = controls.create(dropdownDiv, "div", "dropdown-content");
        dropdownContentDiv.id = "dropdown-id";
    };

    const renderDropdownContent = () => {
        let parent = document.getElementById("dropdown-id");
        if (!parent) return;
        controls.removeAllChildren(parent);
        controls.createA(parent, undefined, "/slideshow", "Bildergalerie");
        controls.createA(parent, undefined, "/notes", "Notizen");
        controls.createA(parent, undefined, "/skat", "Skat");
        controls.createA(parent, undefined, "/diary", "Tagebuch");
        controls.createA(parent, undefined, "/tetris", "Tetris");
        if (currentUser) {
            controls.create(parent, "hr");
            if (currentUser.hasPasswordManagerFile) {
                controls.createA(parent, undefined, "/password", "Passw\u00F6rter");
            }
            controls.createA(parent, undefined, "/usermgmt", "Profil");
            controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        }
        else {
            controls.create(parent, "hr");
            controls.createA(parent, undefined, "/pwdman?nexturl=/markdown", "Anmelden");
        }
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/markdown?page=welcome", "Willkommen");
    };

    const renderPage = () => {
        let parent = document.body;
        controls.removeAllChildren(parent);
        renderDropdown(parent);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
        let div = controls.createDiv(parent);
        let opt = undefined;
        const token = utils.get_authentication_token();
        if (token) {
            opt = { headers: { "token": token } };
        }
        utils.fetch_api_call(`/api/pwdman/markdown/${page}`, opt,
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
        renderDropdownContent();
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
                html = `${prefix}<style>body { background-image: url(${url}) }</style>\n${suffix}`;
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
            controls.createButton(div, "Zur\u00FCck", () => history.back());
        }
    };

    const render = () => {
        const urlParams = new URLSearchParams(window.location.search);
        page = urlParams.get("page");
        if (!page) {
            page = "welcome";
        }
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

    return {
        render: render
    };
})();

window.onload = () => {
    utils.auth_lltoken(markdown.render);
};

window.onclick = (event) => {
    if (!event.target.matches(".dropbtn")) {
        let dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            let openDropdown = dropdowns[i];
            if (openDropdown.classList.contains("show")) {
                openDropdown.classList.remove("show");
            }
        }
    }
};