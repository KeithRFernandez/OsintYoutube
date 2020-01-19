/**
 * YouTube Metadata
 *
 * Grab everything publicly available from the YouTube API.
 *
 * @requires jquery
 */
(function () {
    'use strict';

    const elements = {};
    const controls = {};

    const patterns = {
        video_id: [
            /http[s]?:\/\/(?:www|m).youtube.com\/watch\?v=([\w_-]+)(?:&.*)?/i,
            /http[s]?:\/\/youtu.be\/([\w_-]+)(?:\?.*)?/i
        ],
        playlist_id: [
            /http[s]?:\/\/(?:www|m).youtube.com\/playlist\?list=([\w_-]+)(?:&.*)?/i
        ],
        channel_user: [
            /http[s]?:\/\/(?:www|m).youtube.com\/user\/([\w_-]+)(?:\?.*)?/i
        ],
        channel_id: [
            /http[s]?:\/\/(?:www|m).youtube.com\/channel\/([\w_-]+)(?:\?.*)?/i
        ]
    };

    function determineInput(value) {
        const parsed = {
            type: 'unknown',
            mayHideOthers: true
        };
        for (let type in patterns) {
            for (let i = 0; i < patterns[type].length; i++) {
                const regex = patterns[type][i];
                const result = regex.exec(value);

                if (result) {
                    parsed.type = type;
                    parsed.value = result[1];

                    return parsed;
                }
            }
        }
        return parsed;
    }

    function getDuration(a, b) {
        if (a.isBefore(b)) {
            return moment.duration(b.diff(a));
        } else {
            return moment.duration(a.diff(b));
        }
    }

    function formatDuration(duration, includeMs) {
        const years = duration.years();
        const days = duration.days();
        const hours = duration.hours();
        const minutes = duration.minutes();
        const seconds = duration.seconds();
        const millis = duration.milliseconds();
        const format = [
            (years > 0 ? years + "y" : ""),
            (days > 0 ? days + "d" : ""),
            (hours > 0 ? hours + "h" : ""),
            (minutes > 0 ? minutes + "m" : ""),
            (seconds > 0 ? seconds + "s" : ""),
            includeMs ? (millis > 0 ? millis + "ms" : "") : ""
        ].join(" ");

        if (format.trim() == "") {
            return "0s";
        }

        return format;
    }

    const partMap = {
        /**
         * Can't access part(s): fileDetails, processingDetails, suggestions
         * Useless part(s): player, id
         * Every other part below:
         */
        video: {
            snippet: {
                title: "Fragmento de la página",
                postProcess: function (partJson) {
                    submit({
                        type: 'channel_id',
                        value: partJson.channelId,
                        mayHideOthers: false
                    });

                    const partDiv = $("#video-section #snippet");

                    partDiv.append("<img src='" + partJson.thumbnails.medium.url + "' class='mb-15'>");

                    const titleHtml =
                        "<p class='mb-15' style='font-size: 1.25em'>" + partJson.title + "</p>";
                    partDiv.append(titleHtml);

                    const authorHtml =
                        "<p class='mb-15'><strong>Published by</strong> " +
                            "<a href='https://www.youtube.com/channel/" + partJson.channelId + "' target='_blank'>" +
                                partJson.channelTitle +
                            "</a>" +
                        "</p>";
                    partDiv.append(authorHtml);

                    const published = new Date(partJson.publishedAt);
                    const dateHtml =
                        "<p class='mb-15'><strong>Published on</strong> " +
                            "<span class='orange'>" + published.toUTCString() + "</span>" +
                            " (" + moment(published).fromNow() + ")" +
                        "</p>";
                    partDiv.append(dateHtml);

                    if (partJson.tags) {
                        const tagsHtml =
                            "<p class='mb-15'><strong>Tag(s): </strong>" +
                                "<span class='tag'>" + partJson.tags.join(" </span><span class='tag'>") + "</span>" +
                            "</p>";
                        partDiv.append(tagsHtml);
                    } else {
                        partDiv.append("<p class='mb-15'>There were no tags.</p>")
                    }
                }
            },
            statistics: {
                title: "Estadísticas",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #statistics");

                    if (partJson.hasOwnProperty("likeCount")) {
                        const likes = partJson.likeCount;
                        const dislikes = partJson.dislikeCount;

                        let normalizedLikes = likes, normalizedDislikes = dislikes;
                        let gcdValue = 0, gcdLikes = 0, gcdDislikes = 0;

                        if (likes > 0 && dislikes > 0) {
                            function gcd(p, q) {
                                if (q === 0) {
                                    return p;
                                }
                                return gcd(q, p % q);
                            }
                            gcdValue = gcd(partJson.likeCount, partJson.dislikeCount);
                            gcdLikes = gcdValue === 0 ? 0 : partJson.likeCount / gcdValue;
                            gcdDislikes = gcdValue === 0 ? 0 : partJson.dislikeCount / gcdValue;
                        }

                        if (gcdValue !== 0) {
                            if (gcdLikes > gcdDislikes) {
                                normalizedLikes = gcdLikes / gcdDislikes;
                                normalizedDislikes = 1;
                            } else {
                                normalizedLikes = 1;
                                normalizedDislikes = gcdDislikes / gcdLikes;
                            }
                        }

                        const html =
                            "<p class='mb-15'>" +
                                "<strong>Normalized like ratio:</strong> " +
                                "<span style='color:green'>" + Math.trunc(normalizedLikes) + " like(s)</span> per " +
                                "<span style='color:red'>" + Math.trunc(normalizedDislikes) + " dislike(s)</span>" +
                            "</p>";
                        partDiv.append(html);
                    } else {
                        partDiv.append("<p class='mb-15'>Este video tiene <strong>likes desactivados.</strong></p>")
                    }

                    if (!partJson.hasOwnProperty("viewCount")) {
                        partDiv.append("<p class='mb-15'>Este video tiene <strong>contador de vistas desactivado.</strong></p>")
                    }

                    if (!partJson.hasOwnProperty("commentCount")) {
                        partDiv.append("<p class='mb-15'>Este video tiene <strong>commentarios desactivados.</strong></p>")
                    }

                }
            },
            recordingDetails: {
                title: "Geolocalización",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #recordingDetails");

                    const location = partJson.location;
                    if (location && location.latitude && location.longitude) {
                        const latlng = location.latitude + "," + location.longitude;
                        const staticMap = "https://maps.googleapis.com/maps/api/staticmap?center=" + latlng + "&zoom=13&size=1000x300&key=AIzaSyCGWanOEMEgdHqsxNDaa_ZXTZ6hoYQrnAI&markers=color:red|" + latlng;

                        const html =
                            "<a href='https://maps.google.com/maps?q=loc:"+latlng+"' target='_blank'>" +
                                "<img class='mb-15' src='"+ staticMap +"' alt='Google Maps Static Map'>" +
                                "<p>Click para abrir en Google Maps</p>" +
                            "</a>";

                        partDiv.append(html);
                    }
                }
            },
            status: {
                title: "Status",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #status");

                    if (partJson.hasOwnProperty("embeddable")) {
                        if (partJson.embeddable) {
                            partDiv.append("<p class='mb-15'>Este video puede estar incrustado en otros sitios web</p>")
                        } else {
                            partDiv.append("<p class='mb-15'>This Este video no puede ser incrustado en otros sitios web</p>")
                        }
                    }
                    if (partJson.hasOwnProperty("madeForKids")) {
                        if (partJson.madeForKids) {
                            partDiv.append("<p class='mb-15'>Este video está designado como <span class='orange'>dirigido a los niños</span></p>")
                        } else {
                            partDiv.append("<p class='mb-15'>Este video no está dirigido a los niños</p>")
                        }
                    }
                    if (partJson.hasOwnProperty("selfDeclaredMadeForKids")) {
                        if (partJson.selfDeclaredMadeForKids) {
                            partDiv.append("<p class='mb-15'>El propietario del video designó este video como  <span class='orange'>dirigido a los niños</span></p>")
                        } else {
                            partDiv.append("<p class='mb-15'>El propietario del video designó este video como no dirigido para los niños.</p>")
                        }
                    }
                }
            },
            liveStreamingDetails: {
                title: "Detalles Livestream",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #liveStreamingDetails");

                    const now = moment(new Date());
                    if (partJson.hasOwnProperty("scheduledStartTime") && !partJson.hasOwnProperty("actualStartTime")) {
                        // Stream hasn't started
                        const start = moment(partJson.scheduledStartTime);
                        const format = formatDuration(getDuration(start, now));

                        if (start.isAfter(now)) {
                            partDiv.append("<p class='mb-15'>El stream o ha empezado todavía. Empezará en <span class='orange'>" + format + "</span></p>");
                        } else {
                            partDiv.append("<p class='mb-15'>El stream ha terminado. Se suponía que iba a empezar <span class='orange'>" + format + "</span> ago</p>");
                        }
                    }
                    if (partJson.hasOwnProperty("actualStartTime") && partJson.hasOwnProperty("scheduledStartTime")) {
                        // Stream started. Time between schedule date and actual start?
                        const start = moment(partJson.actualStartTime);
                        const scheduled = moment(partJson.scheduledStartTime);
                        const format = formatDuration(getDuration(start, scheduled));
                        if (start.isAfter(scheduled)) {
                            partDiv.append("<p class='mb-15'>El stream fue <span class='orange'>" + format + "</span> tarde para empezar</p>")
                        } else {
                            partDiv.append("<p class='mb-15'>El stream fue <span class='orange'>" + format + "</span> pronto para emprzar</p>");
                        }
                    }
                    if (partJson.hasOwnProperty("actualStartTime") && !partJson.hasOwnProperty("actualEndTime")) {
                        // Stream started but still going. Time between start and now?
                        const start = moment(partJson.actualStartTime);
                        const format = formatDuration(getDuration(start, now));

                        partDiv.append("<p class='mb-15'>El stream sigue en marcha. ha estado activo por <span class='orange'>" + format + "</span></p>");
                    }
                    if (partJson.hasOwnProperty("actualStartTime") && partJson.hasOwnProperty("actualEndTime")) {
                        // Stream done. Time between start and end?
                        const start = moment(partJson.actualStartTime);
                        const end = moment(partJson.actualEndTime);
                        const format = formatDuration(getDuration(start, end));

                        partDiv.append("<p class='mb-15'>El stream a terminado. Su tiempo de duración fue <span class='orange'>" + format + "</span></p>");
                    }
                }
            },
            localizations: {
                title: "Localización",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #localizations");
                }
            },
            contentDetails: {
                title: "Detalles del contenido",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #contentDetails");

                    const duration = moment.duration(partJson.duration);
                    const format = formatDuration(duration);

                    if (format === "0s") {
                        partDiv.append("<p class='mb-15'>Livestream? El video no debería de ser de 0 segundos.</p>");
                    } else {
                        partDiv.append("<p class='mb-15'>La duración del video fue <span style='color:orange'>" + format + "</span></p>");
                    }
                }
            },
            topicDetails: {
                title: "Detalles del tema",
                postProcess: function (partJson) {
                    const partDiv = $("#video-section #topicDetails");

                    const categories = partJson.topicCategories;
                    if (categories) {
                        for(let i = 0; i < categories.length; i++) {
                            const url = categories[i];
                            const text = url.substr(url.lastIndexOf('/')+1).replace(/_/g, " ");

                            partDiv.append("<p class='mb-15'><a href='" + url + "'>" + text + "</a></p>")
                        }
                    }
                }
            }
        },

        /**
         * Can't access part(s): auditDetails
         * Useless part(s): id
         * Every other part below:
         */
        channel: {
            snippet: {
                title: "Snippet",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #snippet");

                    partDiv.append("<img src='" + partJson.thumbnails.medium.url + "' class='mb-15 profile'>");
                    partDiv.append("<p class='mb-15' style='font-size: 1.25em'>" + partJson.title + "</p>");

                    const published = new Date(partJson.publishedAt);
                    const dateHtml =
                        "<p class='mb-15'><strong>Canal creado el</strong> " +
                            "<span class='orange'>" + published.toUTCString() + "</span>" +
                            " (" + moment(published).fromNow() + ")" +
                        "</p>";
                    partDiv.append(dateHtml);

                    if (partJson.hasOwnProperty("country")) {
                        partDiv.append("<p class='mb-15'>El canal está asociado con el código de país <span class='orange'>" + partJson.country + "</span></p>");
                    } else {
                        partDiv.append("<p class='mb-15'>El canal no tiene un país asociado.</p>");
                    }
                }
            },
            brandingSettings: {
                title: "Configuración de Marca",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #brandingSettings");

                    if (partJson.hasOwnProperty("trackingAnalyticsAccountId")) {
                        partDiv.append("<p class='mb-15'>Este canal está rastreando y midiendo el tráfico con Google Analytics</p>")
                    }

                    if (partJson.moderateComments) {
                        partDiv.append("<p class='mb-15'>Los comentarios en la página del canal requieren la aprobación del propietario del canal.</p>")
                    }
                }
            },
            contentDetails: {
                title: "Detalles del contenido",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #contentDetails");

                    const related = partJson.relatedPlaylists;
                    if (related) {
                        if (related.hasOwnProperty("uploads")) {
                            partDiv.append("<p class='mb-15'><a href='https://www.youtube.com/playlist?list=" + related.uploads + "'>Uploads playlist</a></p>")
                        }
                        if (related.hasOwnProperty("favorites")) {
                            partDiv.append("<p class='mb-15'><a href='https://www.youtube.com/playlist?list=" + related.favorites + "'>Favorites playlist</a></p>")
                        }
                        if (related.hasOwnProperty("likes")) {
                            partDiv.append("<p class='mb-15'><a href='https://www.youtube.com/playlist?list=" + related.likes + "'>Likes playlist</a></p>")
                        }
                    }
                }
            },
            contentOwnerDetails: {
                title: "Detalles del propietario del contenido",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #contentOwnerDetails");
                }
            },
            invideoPromotion: {
                title: "Promoción In-Video",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #invideoPromotion");
                }
            },
            localizations: {
                title: "Localizaciones",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #localizations");
                }
            },
            status: {
                title: "Estado",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #status");

                    const longUploads = partJson.longUploadsStatus;
                    if (longUploads === "allowed") {
                        partDiv.append("<p class='mb-15'>Este canal puede subir videos <span class='orange'>más de 15 minutos</span></p>")
                    } else if (longUploads === "disallowed") {
                        partDiv.append("<p class='mb-15'>Este canal <strong>no puede </strong> subir videos <span class='orange'>más de 15 minutos</span></p>")
                    } else if (longUploads === "eligible") {
                        partDiv.append("<p class='mb-15'>Este canal es elegible para subir videos <span class='orange'>más de 15 minutos</span> pero aún no lo han habilitado.</p>")
                    } else {
                        partDiv.append("<p class='mb-15'>No se especifica si este canal puede subir videos de más de 15 minutos.</p>")
                    }

                    if (partJson.hasOwnProperty("madeForKids")) {
                        if (partJson.madeForKids) {
                            partDiv.append("<p class='mb-15'>Este canal está diseñado para <span class='orange'>niños</span></p>")
                        } else {
                            partDiv.append("<p class='mb-15'>Este canal no está diseñado para niños</p>")
                        }
                    }
                    if (partJson.hasOwnProperty("selfDeclaredMadeForKids")) {
                        if (partJson.selfDeclaredMadeForKids) {
                            partDiv.append("<p class='mb-15'>El propietario del canal designó este canal como <span class='orange'>dirigido para niños</span></p>")
                        } else {
                            partDiv.append("<p class='mb-15'>El propietario del canal designó este canal como no dirigido para niños<</p>")
                        }
                    }
                }
            },
            topicDetails: {
                title: "Topic Details",
                postProcess: function (partJson) {
                    const partDiv = $("#channel-section #topicDetails");

                    const categories = partJson.topicCategories;
                    if (categories) {
                        for(let i = 0; i < categories.length; i++) {
                            const url = categories[i];
                            const text = url.substr(url.lastIndexOf('/')+1).replace(/_/g, " ");

                            partDiv.append("<p class='mb-15'><a href='" + url + "'>" + text + "</a></p>")
                        }
                    }
                }
            }
        },

        /**
         * Useless part(s): id, player
         * Every other part below:
         */
        playlist: {
            snippet: {
                title: "Snippet",
                postProcess: function (partJson) {
                    submit({
                        type: 'channel_id',
                        value: partJson.channelId,
                        mayHideOthers: false
                    });

                    const partDiv = $("#playlist-section #snippet");

                    partDiv.append("<img src='" + partJson.thumbnails.medium.url + "' class='mb-15'>");
                    partDiv.append("<p class='mb-15' style='font-size: 1.25em'>" + partJson.title + "</p>");

                    const authorHtml =
                        "<p class='mb-15'><strong>Publicado por</strong> " +
                            "<a href='https://www.youtube.com/channel/" + partJson.channelId + "' target='_blank'>" +
                                partJson.channelTitle +
                            "</a>" +
                        "</p>";
                    partDiv.append(authorHtml);

                    const published = new Date(partJson.publishedAt);
                    const dateHtml =
                        "<p class='mb-15'><strong>Playlist creado el </strong> " +
                            "<span class='orange'>" + published.toUTCString() + "</span>" +
                            " (" + moment(published).fromNow() + ")" +
                        "</p>";
                    partDiv.append(dateHtml);
                }
            },
            status: {
                title: "Status",
                postProcess: function (partJson) {
                    const partDiv = $("#playlist-section #status");
                }
            },
            localizations: {
                title: "Localización",
                postProcess: function (partJson) {
                    const partDiv = $("#playlist-section #localizations");
                }
            },
            contentDetails: {
                title: "Detalles del contenido",
                postProcess: function (partJson) {
                    const partDiv = $("#playlist-section #contentDetails");
                }
            }
        }
    };

    function parseType(partMapType, sectionId, res) {
        if (res.items.length) {
            const item = res.items[0];

            for (let part in partMap[partMapType]) {
                const section = $("#" + sectionId + " #" + part);
                const sectionHeader = $(section.find(".section-header"));

                if (item.hasOwnProperty(part)) {
                    sectionHeader.removeClass("unknown").addClass("good");
                    sectionHeader.find("i").removeClass("question").addClass("check");

                    section.append("<pre><code class=\"prettyprint json-lang\"></code></pre>");

                    const json = section.find("code");
                    json.text(JSON.stringify(item[part], null, 4));
                    hljs.highlightBlock(json[0]);

                    partMap[partMapType][part].postProcess(item[part]);
                } else {
                    sectionHeader.removeClass("unknown").addClass("bad");
                    sectionHeader.find("i").removeClass("question").addClass("minus");

                    section.append("<p class='mb-15 bad'>The " + partMapType + " does not have " + part + ".</p>");
                }
            }
        } else {
            console.log('bad value');
        }
    }

    async function parseVideo(res) {
        parseType("video", "video-section", res);
    }

    async function parsePlaylist(res) {
        parseType("playlist", "playlist-section", res);
    }

    async function parseChannel(res) {
        parseType("channel", "channel-section", res);
    }

    async function submit(parsedInput) {
        console.log(parsedInput);

        if (parsedInput.type === 'unknown') {
            console.log("didn't recognize your input");
        } else if (parsedInput.type === 'video_id') {
            console.log('grabbing video');

            if (parsedInput.mayHideOthers) {
                $("#playlist").hide();
            }

            youtube.ajax('videos', {
                part: Object.keys(partMap.video).join(','),
                id: parsedInput.value
            }).done(function (res) {
                console.log(res);

                parseVideo(res);

                const id = parsedInput.value;
                const thumbsDiv = $("#thumbnails");

                thumbsDiv.empty();
                for (let i = 0; i < 4; i++) {
                    const thumbUrl = "https://img.youtube.com/vi/" + id + "/" + i + ".jpg";
                    const html =
                        "<div class='mb-15 column'>" +
                            "<a href='https://www.google.com/searchbyimage?image_url=" + thumbUrl + "' target='_blank'>" +
                                "<img src='"+ thumbUrl +"' alt='Thumb " + i + "' style='max-width: 200px;'>" +
                                "<p>Click para busqueda inversa de imágenes</p>" +
                            "</a>" +
                        "</div>";

                    thumbsDiv.append(html);
                }
            }).fail(function (err) {
                console.log(err);
            });
        } else if (parsedInput.type === 'channel_id') {
            console.log('grabbing channel id');

            if (parsedInput.mayHideOthers) {
                $("#video,#playlist").hide();
            }

            youtube.ajax('channels', {
                part: Object.keys(partMap.channel).join(','),
                id: parsedInput.value
            }).done(function (res) {
                console.log(res);

                parseChannel(res);
            }).fail(function (err) {
                console.error(err);
            });
        } else if (parsedInput.type === 'channel_user') {
            console.log('grabbing channel user');

            if (parsedInput.mayHideOthers) {
                $("#video,#playlist").hide();
            }

            youtube.ajax('channels', {
                part: Object.keys(partMap.channel).join(','),
                forUsername: parsedInput.value
            }).done(function (res) {
                console.log(res);

                parseChannel(res);
            }).fail(function (err) {
                console.error(err);
            });
        } else if (parsedInput.type === 'playlist_id') {
            console.log('grabbing playlist');

            if (parsedInput.mayHideOthers) {
                $("#video").hide();
            }

            youtube.ajax('playlists', {
                part: Object.keys(partMap.playlist).join(','),
                id: parsedInput.value
            }).done(function (res) {
                console.log(res);

                parsePlaylist(res);
            }).fail(function (err) {
                console.error(err);
            });
        }
    }

    const internal = {
        init: function () {
            controls.inputValue = $("#value");
            controls.btnSubmit = $("#submit");
            controls.shareLink = $("#shareLink");

            new ClipboardJS(".clipboard");

            elements.videoSection = $("#video-section");
            elements.channelSection = $("#channel-section");
            elements.playlistSection = $("#playlist-section");

            internal.buildPage(true);
        },
        buildPage: function(doSetup) {
            $(".part-section").remove();
            $("#thumbnails").empty();

            for (let part in partMap.video) {
                const partData = partMap.video[part];
                const html =
                    "<div id='" + part + "' class='part-section'>" +
                        "<div class='section-header unknown'><i class='expand'></i><span>" + partData.title + "</span></div>" +
                    "</div>";
                elements.videoSection.append(html);
            }

            for (let part in partMap.channel) {
                const partData = partMap.channel[part];
                const html =
                    "<div id='" + part + "' class='part-section'>" +
                        "<div class='section-header unknown'><i class='expand'></i><span>" + partData.title + "</span></div>" +
                    "</div>";
                elements.channelSection.append(html);
            }

            for (let part in partMap.playlist) {
                const partData = partMap.playlist[part];
                const html =
                    "<div id='" + part + "' class='part-section'>" +
                    "<div class='section-header unknown'><i class='expand'></i><span>" + partData.title + "</span></div>" +
                    "</div>";
                elements.playlistSection.append(html);
            }

            if (doSetup) {
                internal.setupControls();
            }
        },
        setupControls: function() {
            controls.inputValue.on('keypress', function (e) {
                if (e.originalEvent.code === "Enter") {
                    controls.btnSubmit.click();
                }
            });
            controls.btnSubmit.on('click', function () {
                const value = controls.inputValue.val();

                const baseUrl = location.origin + location.pathname;
                controls.shareLink.val(baseUrl + "?url=" + encodeURIComponent(value) + "&submit=true");
                controls.shareLink.attr("disabled", false);

                const parsed = determineInput(value);

                $("#video,#playlist,#channel").show();
                internal.buildPage(false);
                submit(parsed);
            });

            function parseQuery(queryString) {
                var query = {};
                var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                }
                return query;
            }
            const query = parseQuery(window.location.search);
            console.log(query);
            if (query.hasOwnProperty("url")) {
                controls.inputValue.val(decodeURIComponent(query.url));
            }
            if (query.hasOwnProperty("submit") && String(query.submit).toLowerCase() === String(true)) {
                setTimeout(function () {
                    controls.btnSubmit.click();
                }, 500);
            }
        }
    };
    $(document).ready(internal.init);
}());