"use strict";

var slideshow = (() => {

    // --- UI elements

    let divSlideShowInfo;
    let btnPlaySlideShow;
    let btnPauseSlideShow;
    let divFooter;
    let imgShuffle;

    // --- state

    let isSlideshowPlaying = true;
    let shuffle = true;

    let slideShowPictures;
    let slideShowInterval = 10;
    let backgroundChanged;
    let backgroundIndex = 0;
    let backgroundText;

    let currentUser;

    // --- rendering

    const renderDropdown = (parent) => {
        let dropdownDiv = controls.create(parent, "div", "dropdown");
        dropdownDiv.id = "div-dropdown-id";
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
            controls.createA(parent, undefined, "/pwdman?nexturl=/slideshow", "Anmelden");
        }
        controls.create(parent, "hr");
        controls.createA(parent, undefined, "/markdown?page=impressum", "Impressum");
    };

    const renderHeader = (parent) => {
        let title = currentUser ? `${currentUser.name} - Bildergalerie` : "Bildergalerie";
        let header = controls.create(parent, "h1", "header", title);
        header.id = "header-id";
        imgShuffle = controls.createImg(parent, "header-shuffle-img", 24, 24, "/images/buttons/document-quick_restart.png");
        imgShuffle.title = "Zufallswiedergabe " + (shuffle ? "aus" : "ein");
        if (!shuffle) {
            imgShuffle.classList.add("greyed-out");
        }
        imgShuffle.addEventListener("click", () => window.location.replace(`/slideshow?shuffle=${!shuffle}`));
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo);
            imgPhoto.title = "Profil";
            imgPhoto.addEventListener("click", () => window.location.href = "/usermgmt");
        }
    };

    const renderSlideshowInfo = (parent) => {
        let div = controls.createDiv(parent);
        divSlideShowInfo = controls.createDiv(div, "slideshow-info");
        if (backgroundText) {
            divSlideShowInfo.textContent = backgroundText;
        }
        btnPauseSlideShow = controls.createImageButton(div, "Bildergalerie anhalten",
            () => {
                isSlideshowPlaying = false;
                btnPauseSlideShow.style.visibility = "hidden";
                btnPlaySlideShow.style.visibility = "visible";
            },
            "/images/buttons/media-playback-pause-3.png", 24, "slideshow-action");
        btnPlaySlideShow = controls.createImageButton(div, "Bildergalerie abspielen",
            () => {
                isSlideshowPlaying = true;
                btnPauseSlideShow.style.visibility = "visible";
                btnPlaySlideShow.style.visibility = "hidden";
            },
            "/images/buttons/media-playback-start-3.png", 24, "slideshow-action");
        btnPauseSlideShow.style.visibility = isSlideshowPlaying ? "visible" : "hidden";
        btnPlaySlideShow.style.visibility = !isSlideshowPlaying ? "visible" : "hidden";
    };

    const renderPage = () => {
        controls.removeAllChildren(document.body);
        renderDropdown(document.body);
        renderHeader(document.body);
        divFooter = controls.createDiv(document.body, "footer");
        renderSlideshowInfo(divFooter);
        renderDropdownContent();
        window.onclick = (event) => {
            let dropdownClosed = false;
            if (!event.target.matches(".dropbtn")) {
                let dropdowns = document.getElementsByClassName("dropdown-content");
                for (let i = 0; i < dropdowns.length; i++) {
                    let openDropdown = dropdowns[i];
                    if (openDropdown.classList.contains("show")) {
                        openDropdown.classList.remove("show");
                        dropdownClosed = true;
                    }
                }
            }
            if (!dropdownClosed) {
                let dropdownDivElem = document.getElementById("div-dropdown-id");
                let headerElem = document.getElementById("header-id");
                if (event.target.tagName == "HTML") {
                    if (divFooter.style.visibility != "hidden") {
                        divFooter.style.visibility = "hidden";
                        dropdownDivElem.style.visibility = "hidden";
                        headerElem.style.visibility = "hidden";
                        imgShuffle.style.visibility = "hidden";
                    }
                    else {
                        divFooter.style.visibility = "visible";
                        dropdownDivElem.style.visibility = "visible";
                        headerElem.style.visibility = "visible";
                        imgShuffle.style.visibility = "visible";
                    }
                }
            }
        };
    };

    const fetchCurrentUser = (token) => {
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

    const render = () => {
        currentUser = undefined;
        let token = utils.get_authentication_token();
        if (!token) {
            renderPage();
            return;
        }
        fetchCurrentUser(token);
    };

    // --- callbacks

    const ontimer = () => {
        if (!slideShowPictures || slideShowPictures.length == 0 || !isSlideshowPlaying) return;
        let currentDate = new Date();
        if ((!backgroundChanged ||
                ((currentDate.getTime() - backgroundChanged.getTime()) / 1000) > slideShowInterval)) {
            let pic = slideShowPictures[backgroundIndex];
            document.body.style.background = `#000000 url('${pic.url}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
            backgroundIndex = (backgroundIndex + 1) % slideShowPictures.length;
            backgroundChanged = currentDate;
            let txts = [pic.summary, pic.city, pic.country, utils.format_date(pic.date)];
            backgroundText = utils.concat_strings(txts, " // ");
            if (divSlideShowInfo) {
                divSlideShowInfo.textContent = backgroundText;
            }
        }
    }

    const sortSlideShowPictures = () => {
        slideShowPictures.sort((a, b) => {
            if (a.date && a.date.length > 0 && b.date && b.date.length > 0) {
                let da = new Date(a.date);
                let db = new Date(b.date);
                return db.getTime() - da.getTime();
            }
            if (a.date && a.date.length > 0) {
                return -1;
            }
            if (b.date && b.date.length > 0) {
                return 1;
            }
            return a.summary.localeCompare(b.summary);
        });
    };

    const initSlideShow = (pictures, interval) => {
        slideShowPictures = pictures;
        if (pictures && pictures.length > 0) {
            let params = new URLSearchParams(window.location.search);
            if (params.has("shuffle")) {
                shuffle = params.get("shuffle") == "true";
            }
            if (shuffle) {
                utils.shuffle_array(slideShowPictures);
            }
            else {
                sortSlideShowPictures();
            }
            if (interval) {
                slideShowInterval = interval;
                ontimer();
                window.setInterval(ontimer, interval * 1000);
            }
        }
    };

    // --- public API

    return {
        render: render,
        initSlideShow: initSlideShow,
        ontimer: ontimer
    };
})();

window.onload = () => {
    utils.auth_lltoken(() => {
        let token = utils.get_authentication_token();
        utils.fetch_api_call("api/pwdman/slideshow", { headers: { "token": token } },
            (model) => {
                slideshow.initSlideShow(model.pictures, model.interval);
                slideshow.render();
            },
            (errMsg) => {
                console.error(errMsg);
                slideshow.render();
            });
    });
};
