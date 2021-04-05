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
                controls.createA(parent, undefined, "/pwdman", "Passwort\u00A0Manager");
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
                div.innerHTML = html;
                const h1 = document.querySelector("h1");
                if (h1) {
                    document.title = h1.textContent;
                    if (currentUser && currentUser.name) {
                        h1.textContent = `${currentUser.name} - ` + h1.textContent;
                    }
                }
                if (history.length > 1) {
                    controls.createButton(div, "Zur\u00FCck", () => history.back());
                }
            });
        renderDropdownContent();
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