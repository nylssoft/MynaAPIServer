/// <binding BeforeBuild='all' />
module.exports = function (grunt) {
    grunt.initConfig({
        clean: ["wwwroot/js/**/*.min.js", "temp/*", "wwwroot/css/**/*.min.css"],
        concat: {
            backgammon: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/backgammon/backgammon.js"],
                dest: "temp/backgammon.js"
            },
            chess: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/chess/chess.js"],
                dest: "temp/chess.js"
            },
            contacts: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/contacts/contacts.js"],
                dest: "temp/contacts.js"
            },
            diary: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/diary/diary.js"],
                dest: "temp/diary.js"
            },
            documents: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/documents/documents.js"],
                dest: "temp/documents.js"
            },
            markdown: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/markdown/markdown.js"],
                dest: "temp/markdown.js"
            },
            notes: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/notes/notes.js"],
                dest: "temp/notes.js"
            },
            password: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/password/password.js"],
                dest: "temp/password.js"
            },
            pwdman: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/pwdman/pwdman.js"],
                dest: "temp/pwdman.js"
            },
            usermgmt: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/pwdman/usermgmt.js"],
                dest: "temp/usermgmt.js"
            },
            skat: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/skat/skat.js"],
                dest: "temp/skat.js"
            },
            slideshow: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/slideshow/slideshow.js"],
                dest: "temp/slideshow.js"
            },
            tetris: {
                src: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/tetris/tetris.js"],
                dest: "temp/tetris.js"
            }
        },
        jshint: {
            files: [
                "temp/backgammon.js",
                "temp/chess.js",
                "temp/contacts.js",
                "temp/diary.js",
                "temp/documents.js",
                "temp/markdown.js",
                "temp/notes.js",
                "temp/password.js",
                "temp/pwdman.js",
                "temp/usermgmt.js",
                "temp/skat.js",
                "temp/slideshow.js",
                "temp/tetris.js"],
            options: {
                "esversion": 9,
                "force": true
            }
        },
        uglify: {
            backgammon: {
                src: ["temp/backgammon.js"],
                dest: "wwwroot/js/backgammon/backgammon.min.js"
            },
            chess: {
                src: ["temp/chess.js"],
                dest: "wwwroot/js/chess/chess.min.js"
            },
            contacts: {
                src: ["temp/contacts.js"],
                dest: "wwwroot/js/contacts/contacts.min.js"
            },
            diary: {
                src: ["temp/diary.js"],
                dest: "wwwroot/js/diary/diary.min.js"
            },
            documents: {
                src: ["temp/documents.js"],
                dest: "wwwroot/js/documents/documents.min.js"
            },
            markdown: {
                src: ["temp/markdown.js"],
                dest: "wwwroot/js/markdown/markdown.min.js"
            },
            notes: {
                src: ["temp/notes.js"],
                dest: "wwwroot/js/notes/notes.min.js"
            },
            password: {
                src: ["temp/password.js"],
                dest: "wwwroot/js/password/password.min.js"
            },
            pwdman: {
                src: ["temp/pwdman.js"],
                dest: "wwwroot/js/pwdman/pwdman.min.js"
            },
            usermgmt: {
                src: ["temp/usermgmt.js"],
                dest: "wwwroot/js/pwdman/usermgmt.min.js"
            },
            skat: {
                src: ["temp/skat.js"],
                dest: "wwwroot/js/skat/skat.min.js"
            },
            slideshow: {
                src: ["temp/slideshow.js"],
                dest: "wwwroot/js/slideshow/slideshow.min.js"
            },
            tetris: {
                src: ["temp/tetris.js"],
                dest: "wwwroot/js/tetris/tetris.min.js"
            }
        },
        watch: {
            files: [
                "wwwroot/js/common/utils.js",
                "wwwroot/js/common/controls.js",
                "wwwroot/js/backgammon/backgammon.js",
                "wwwroot/js/chess/chess.js",
                "wwwroot/js/contacts/contacts.js",
                "wwwroot/js/diary/diary.js",
                "wwwroot/js/documents/documents.js",
                "wwwroot/js/markdown/markdown.js",
                "wwwroot/js/notes/notes.js",
                "wwwroot/js/password/password.js",
                "wwwroot/js/pwdman/pwdman.js",
                "wwwroot/js/pwdman/usermgmt.js",
                "wwwroot/js/skat/skat.js",
                "wwwroot/js/slideshow/slideshow.js",
                "wwwroot/js/tetris/tetris.js"],
            tasks: ["all"]
        },
        cssmin: {
            target: {
                files: {
                    "wwwroot/css/backgammon/backgammon.min.css": ["wwwroot/css/backgammon/backgammon.css"],
                    "wwwroot/css/chess/chess.min.css": ["wwwroot/css/chess/chess.css"],
                    "wwwroot/css/contacts/contacts.min.css": ["wwwroot/css/contacts/contacts.css"],
                    "wwwroot/css/diary/diary.min.css": ["wwwroot/css/diary/diary.css"],
                    "wwwroot/css/documents/documents.min.css": ["wwwroot/css/documents/documents.css"],
                    "wwwroot/css/markdown/markdown.min.css": ["wwwroot/css/markdown/markdown.css"],
                    "wwwroot/css/notes/notes.min.css": ["wwwroot/css/notes/notes.css"],
                    "wwwroot/css/password/password.min.css": ["wwwroot/css/password/password.css"],
                    "wwwroot/css/pwdman/pwdman.min.css": ["wwwroot/css/pwdman/pwdman.css"],
                    "wwwroot/css/skat/skat.min.css": ["wwwroot/css/skat/skat.css"],
                    "wwwroot/css/slideshow/slideshow.min.css": ["wwwroot/css/slideshow/slideshow.css"],
                    "wwwroot/css/tetris/tetris.min.css": ["wwwroot/css/tetris/tetris.css"],
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-cssmin');

    grunt.registerTask('all', ['clean', 'concat', 'jshint', 'uglify', 'cssmin'])
};