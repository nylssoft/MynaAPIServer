"use strict";

var homepage = (() => {

    let currentUser;

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        let dropdownButton = controls.createImg(dropdownDiv, "dropbtn", 24, 24, "/images/homepage/hamburger.svg");
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
            controls.createA(parent, undefined, "/pwdman?nexturl=/slideshow", "Anmelden");
        }
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/downloads", "Downloads");
        controls.createA(parent, undefined, "/impressum", "Impressum");
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
        let divPublic = controls.createDiv(parent);
        let divPrivate = controls.createDiv(parent);
        utils.fetch_api_call("/api/pwdman/markdown/homepage", undefined, (html) => divPublic.innerHTML = html);
        if (currentUser && currentUser.roles.includes("family")) {
            let token = utils.get_authentication_token();
            utils.fetch_api_call("/api/pwdman/markdown/family", { headers: { "token": token } }, (html) => divPrivate.innerHTML = html);
        }
        renderDropdownContent();
    };

    const render = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
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
    utils.auth_lltoken(homepage.render);
};
