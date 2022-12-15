var slideshow = (() => {

    "use strict";

    // --- UI elements

    let divSlideShowInfo;
    let divFooter;
    let imgPlaySlideShow;
    let imgPauseSlideShow;
    let imgShuffle;
    let imgLeftArrow;
    let imgRightArrow;

    // --- state

    let isSlideshowPlaying = true;
    let shuffle = true;

    let slideShowPictures;
    let slideShowInterval = 10;
    let backgroundChanged;
    let backgroundIndex = 0;
    let backgroundText;

    let currentUser;

    let touchX;
    let touchId;

    // --- rendering

    const renderHeader = (parent) => {
        let title = currentUser ? `${currentUser.name} - ${_T("HEADER_SLIDESHOW")}` : _T("HEADER_SLIDESHOW");
        title += ` ${backgroundIndex}/${slideShowPictures.length}`;
        let header = controls.create(parent, "h1", "header", title);
        header.id = "header-id";
        imgPauseSlideShow = controls.createImg(parent, "header-pause-img header-img", 24, 24, "/images/buttons/media-playback-pause-3.png", _T("BUTTON_PAUSE_SLIDESHOW"));
        imgPauseSlideShow.addEventListener("click", () => {
            isSlideshowPlaying = false;
            imgPauseSlideShow.style.visibility = "hidden";
            imgPlaySlideShow.style.visibility = "visible";
            imgLeftArrow.classList.add("greyed-out");
            imgRightArrow.classList.add("greyed-out");
        });
        imgPauseSlideShow.style.visibility = isSlideshowPlaying ? "visible" : "hidden";
        imgPlaySlideShow = controls.createImg(parent, "header-pause-img header-img", 24, 24, "/images/buttons/media-playback-start-3.png", _T("BUTTON_PLAY_SLIDESHOW"));
        imgPlaySlideShow.addEventListener("click", () => {
            isSlideshowPlaying = true;
            imgPauseSlideShow.style.visibility = "visible";
            imgPlaySlideShow.style.visibility = "hidden";
            imgLeftArrow.classList.remove("greyed-out");
            imgRightArrow.classList.remove("greyed-out");
        });
        imgPlaySlideShow.style.visibility = !isSlideshowPlaying ? "visible" : "hidden";
        const shuffleTxt = shuffle ? _T("BUTTON_SLIDESHOW_RANDOM_ON") : _T("BUTTON_SLIDESHOW_RANDOM_OFF");
        imgShuffle = controls.createImg(parent, "header-shuffle-img header-img", 24, 24, "/images/buttons/media-seek-forward-3.png", shuffleTxt);
        if (!shuffle) {
            imgShuffle.classList.add("greyed-out");
        }
        imgShuffle.addEventListener("click", () => utils.replace_window_location(`/slideshow?shuffle=${!shuffle}`));
        imgLeftArrow = controls.createImg(parent, "header-leftarrow-img header-img", 24, 24, "/images/buttons/arrow-left-2-24.png", _T("BUTTON_PREV_PICTURE"));
        imgLeftArrow.addEventListener("click", onPictureLeft);
        imgRightArrow = controls.createImg(parent, "header-rightarrow-img header-img", 24, 24, "/images/buttons/arrow-right-2-24.png", _T("BUTTON_NEXT_PICTURE"));
        imgRightArrow.addEventListener("click", onPictureRight);
        if (currentUser && currentUser.photo) {
            let imgPhoto = controls.createImg(parent, "header-profile-photo", 32, 32, currentUser.photo, _T("BUTTON_PROFILE"));
            imgPhoto.addEventListener("click", () => utils.set_window_location("/usermgmt"));
        }
    };

    const renderSlideshowInfo = (parent) => {
        let div = controls.createDiv(parent);
        divSlideShowInfo = controls.createDiv(div, "slideshow-info");
        if (backgroundText) {
            divSlideShowInfo.textContent = backgroundText;
        }
    };

    const renderPage = () => {
        controls.removeAllChildren(document.body);
        utils.create_cookies_banner(document.body);
        utils.create_menu(document.body);
        renderHeader(document.body);
        divFooter = controls.createDiv(document.body, "footer");
        renderSlideshowInfo(divFooter);
        utils.set_menu_items(currentUser);
        document.addEventListener("keydown", (e) => {
            if (e.key == "ArrowLeft") {
                onPictureLeft();
            }
            else if (e.key == "ArrowRight") {
                onPictureRight();
            }
        });

        document.addEventListener("touchstart", (e) => {
            if (e.changedTouches.length === 1) {
                touchX = e.changedTouches[0].clientX;
                touchId = e.changedTouches[0].identifier;
            }
        }, {passive: false});
        document.addEventListener("touchend", (e) => {
            if (e.changedTouches.length === 1 && e.changedTouches[0].identifier === touchId) {
                const diff = e.changedTouches[0].clientX - touchX;
                if (diff > 100) {
                    onPictureLeft();
                }
                else if (diff < -100) {
                    onPictureRight();
                }
                touchId = undefined;
            }
        }, { passive: false });
        document.addEventListener("touchcancel", (e) => {
            touchId = undefined;
        }, { passive: false });

        window.onclick = (event) => {
            utils.hide_menu(event);
            if (utils.is_menu_hidden()) {
                let dropdownDivElem = document.getElementById("div-dropdown-id");
                let headerElem = document.getElementById("header-id");
                if (event.target.tagName == "HTML") {
                    const imgProfile = document.querySelector(".header-profile-photo");
                    if (divFooter.style.visibility != "hidden") {
                        divFooter.style.visibility = "hidden";
                        dropdownDivElem.style.visibility = "hidden";
                        headerElem.style.visibility = "hidden";
                        if (isSlideshowPlaying) {
                            imgPauseSlideShow.style.visibility = "hidden";
                        }
                        else {
                            imgPlaySlideShow.style.visibility = "hidden";
                        }
                        imgShuffle.style.visibility = "hidden";
                        imgRightArrow.style.visibility = "hidden";
                        imgLeftArrow.style.visibility = "hidden";
                        if (imgProfile) {
                            imgProfile.style.visibility = "hidden";
                        }
                    }
                    else {
                        divFooter.style.visibility = "visible";
                        dropdownDivElem.style.visibility = "visible";
                        headerElem.style.visibility = "visible";
                        if (isSlideshowPlaying) {
                            imgPauseSlideShow.style.visibility = "visible";
                        }
                        else {
                            imgPlaySlideShow.style.visibility = "visible";
                        }
                        imgShuffle.style.visibility = "visible";
                        imgRightArrow.style.visibility = "visible";
                        imgLeftArrow.style.visibility = "visible";
                        if (imgProfile) {
                            imgProfile.style.visibility = "visible";
                        }
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

    const onPictureLeft = () => {
        if (isSlideshowPlaying && slideShowPictures.length > 2) {
            if (backgroundIndex == 1) {
                backgroundIndex = slideShowPictures.length - 1;
            }
            else if (backgroundIndex == 0) {
                backgroundIndex = slideShowPictures.length - 2;
            }
            else if (backgroundIndex > 1) {
                backgroundIndex = backgroundIndex - 2;
            }
            backgroundChanged = false;
            ontimer();
        }
    };

    const onPictureRight = () => {
        if (isSlideshowPlaying && slideShowPictures.length > 1) {
            backgroundChanged = false;
            ontimer();
        }
    };

    const ontimer = () => {
        if (!slideShowPictures || slideShowPictures.length == 0 || !isSlideshowPlaying) return;
        let currentDate = new Date();
        if ((!backgroundChanged ||
            ((currentDate.getTime() - backgroundChanged.getTime()) / 1000) > slideShowInterval)) {
            let pic = slideShowPictures[backgroundIndex];
            const ratio = window.innerWidth / window.innerHeight;
            const url = ratio < 1.7 && pic.url43 ? pic.url43 : pic.url;
            document.body.style.background = `#000000 url('${url}')`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundRepeat = "no-repeat";
            const header = document.getElementById("header-id");
            if (header) {
                header.textContent = currentUser ? `${currentUser.name} - ${_T("HEADER_SLIDESHOW")}` : _T("HEADER_SLIDESHOW");
                header.textContent += ` ${backgroundIndex + 1}/${slideShowPictures.length}`;
            }
            backgroundIndex = (backgroundIndex + 1) % slideShowPictures.length;
            backgroundChanged = currentDate;
            let txts = [pic.summary, pic.city, pic.country, utils.format_date(pic.date, { year: "numeric", month: "short", day: "numeric" })];
            backgroundText = utils.concat_strings(txts, " // ");
            if (divSlideShowInfo) {
                divSlideShowInfo.textContent = backgroundText;
            }
        }
    };

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
        utils.set_locale(() => {
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
    });
};
