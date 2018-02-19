var Twit = require('twit');
var rp = require('request-promise');
var T = new Twit(require('./tconfig'));
var stream = T.stream('statuses/filter', {
    track: '@playlist_bot' //track mentions
});


stream.on('tweet', function (tweet) {
    var playlistName = "@" + tweet.user.screen_name + " ";
    var input = tweet.text.replace("@playlist_bot", "").split(",");
    makeRequests(input, playlistName, tweet).catch(function (error) { //handles Spotify API requests and tweets back response
        console.log(error);
    });
});


async function makeRequests(input, playlistName, tweet) {
    var response = await rp(refreshToken()); //request new access token
    var access_token = response.access_token;
    var artistIDs = "";
    for (var i = 0; i < input.length; i++) {
        response = await rp(searchArtist(access_token, input[i].trim()));
        if (response.artists.items.length > 0) { //if spotify search gives a response
            artistIDs += response.artists.items[0].id + ",";
            playlistName += response.artists.items[0].name + ", ";
        } else {
            console.log("No artist named: " + input[i]);
        }
    }

    if (artistIDs === "") { //no artists were found in the tweet (or typos)
        var params = {
            status: "@" + tweet.user.screen_name + ", the artist(s) you specified could not be found. Check for typos.",
            in_reply_to_status_id: tweet.id_str,
        };
        T.post('statuses/update', params, function (err, data, response) { //tweet back the playlist
            console.log(data);
        });
        return;
    }

    playlistName = playlistName.substring(0, playlistName.length - 2);
    artistIDs = artistIDs.substring(0, artistIDs.length - 1);
    var tracks = [];

    response = await rp(getReccommendations(access_token, artistIDs)); //get reccomendations given artists
    for (var i = 0; i < response.tracks.length; i++) {
        tracks.push(response.tracks[i].uri); //add the recommended songs to tracks array
    }

    response = await rp(createPlaylist(access_token, playlistName)); //create the playlist
    var playlist_id = response.id;
    var url = response.external_urls.spotify;

    response = await rp(addTracks(access_token, playlist_id, tracks)); //add reccommended tracks to playlist

    var params = {
        status: "@" + tweet.user.screen_name + " " + url,
        in_reply_to_status_id: tweet.id_str,
    };

    if (url !== undefined)
        T.post('statuses/update', params, function (err, data, response) { //tweet back the playlist
            console.log(data);
        });
}


function refreshToken() {
    return {
        method: 'POST',
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            Authorization: 'Basic ' + process.env.AUTH_CODE
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: process.env.REFRESH_TOKEN,
        },
        json: true
    };
}


function searchArtist(access_token, artist) {
    return {
        method: 'GET',
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        qs: {
            q: artist,
            type: 'artist',
            limit: '1'
        },
        json: true
    };
}


function getReccommendations(access_token, artistIDs) {
    return {
        method: 'GET',
        url: 'https://api.spotify.com/v1/recommendations',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        qs: {
            seed_artists: artistIDs,
            limit: '20'
        },
        json: true
    };
}


function createPlaylist(access_token, playlistName) {
    return {
        method: 'POST',
        url: 'https://api.spotify.com/v1/users/49gjd8e3t7yo16ejjy7zga3xb/playlists',
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json'
        },
        body: {
            name: playlistName
        },
        json: true
    };
}


function addTracks(access_token, playlist_id, tracks) {
    return {
        method: 'POST',
        url: 'https://api.spotify.com/v1/users/49gjd8e3t7yo16ejjy7zga3xb/playlists/' + playlist_id + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json'
        },
        body: {
            uris: tracks
        },
        json: true
    };
}