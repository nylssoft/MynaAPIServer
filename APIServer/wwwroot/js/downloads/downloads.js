"use strict";

var downloads = (() => {

    let currentUser;

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/downloads/hamburger.svg");
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
            controls.createA(parent, undefined, "/usermgmt", "Profil");
            controls.createA(parent, undefined, "/usermgmt?logout", "Abmelden");
        }
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/impressum", "Impressum");
    };

    const renderCopyright = (parent) => {
        let div = controls.createDiv(parent);
        controls.create(div, "span", "copyright", "Myna Downloads 1.1.0. Copyright 2020-2021 ");
        controls.createA(div, "copyright", "/homepage", "Niels Stockfleth");
        controls.create(div, "span", "copyright", ".");
    };

    const renderMainPage = (parent, apps) => {
        renderDropdown(parent);
        let title = currentUser ? `${currentUser.name} - Downloads` : "Downloads";
        controls.create(parent, "h1", undefined, title);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
        apps.forEach( (app) => {
            let divApp = controls.createDiv(parent, "app");
            let p = controls.create(divApp, "h2", undefined, `${app.title} - ${app.version}`);
            controls.createButton(p, "Download", () => { window.location.href = `${app.download}`; });
            let a = controls.createA(p, "github", `${app.github}`, "GitHub");
            a.target = "_blank";
            controls.create(divApp, "p", undefined, `${app.description}`);
            if (app.prepare.length > 0) {
                let prepare = controls.create(divApp, "p", undefined, `Installationsvorraussetzung: ${app.prepare}`);
                if (app.preparedownload.length > 0) {
                    let ap = controls.createA(prepare, "prepare", `${app.preparedownload}`, "Microsoft");
                    ap.target = "_blank";
                }
            }
            controls.createImg(divApp, undefined, 350, 200, app.image);
        });
        renderCopyright(controls.createDiv(parent));
        renderDropdownContent();
    };

    const renderPage = (json) => {
        controls.removeAllChildren(document.body);
        let divMain = controls.createDiv(document.body);
        renderMainPage(divMain, json.apps);
    };

    const render = (json) => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            renderPage(json);
            return;
        }
        utils.fetch_api_call("api/pwdman/user", { headers: { "token": token } },
            (user) => {
                currentUser = user;
                renderPage(json);
            },
            (errmsg) => {
                console.error(errmsg);
                utils.logout();
                renderPage(json);
            });
    };

    // --- public API

    return {
        render: render
    };
})();

window.onload = () => {
    utils.auth_lltoken(() => {
        fetch("/downloads/apps.json", { cache: "no-cache" })
            .then(response => response.json())
            .then(json => downloads.render(json));
    });
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
