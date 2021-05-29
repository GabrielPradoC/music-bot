"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
var Discord = require("discord.js");
var token = process.env.AUTH;
var prefix = process.env.PREFIX;
var ytdl = require("ytdl-core");
var client = new Discord.Client();
var ytpl = require("ytpl");
var queueConstructor = /** @class */ (function () {
    function queueConstructor(vc) {
        this.voiceChannel = vc;
        this.connection = null;
        this.nowPlaying = null;
        this.nowPlayingTimeLeft = null;
        this.songs = [];
        this.volume = 3;
        this.playing = true;
    }
    return queueConstructor;
}());
var queue = new Map();
client.once("ready", function () {
    console.log("Ready! " + client.user.username);
});
client.on("error", function (error) {
    return console.log("The WebSocket encountered an error:" + error);
});
client.on("reconnecting", function () { return console.log("Reconnecting!"); });
client.on("disconnect", function () { return console.log("Disconnect!"); });
client.on("message", function (message) {
    if (message.author.bot || !message.content.startsWith(prefix))
        return;
    var args = message.content.slice(prefix.length).trim().split(/ +/);
    var serverQueue = queue.get(message.guild.id);
    switch (args[0]) {
        case "play":
            args.shift();
            inputHandler(message, args.join(" "), serverQueue);
            break;
        case "skip":
            skip(message, serverQueue);
            break;
        case "stop":
            stop(message, serverQueue);
            break;
        case "queue":
            args.shift();
            queueDisplayHandler(message, serverQueue.songs, +args[0] || 1);
            break;
        case "pause":
            pause(message, serverQueue);
            break;
        case "resume":
            resume(message, serverQueue);
            break;
        case "np":
            nowPlaying(message, serverQueue);
            break;
        case "remove":
            if (!serverQueue)
                return message.channel.send("There's no songs in the queue.");
            if (+args[1] <= 0 ||
                !args[1] ||
                +args[1] > serverQueue.songs.length ||
                isNaN(+args[1]))
                return message.channel.send("Invalid index.");
            removeMusic(serverQueue, message, +args[1] - 1);
            break;
        case "help":
            message.channel.send("```Commands:\n" + prefix + "play (youtube link)\n" + prefix + "skip\n" + prefix + "stop\n" + prefix + "queue\n" + prefix + "pause\n" + prefix + "resume\n" + prefix + "np\n" + prefix + "remove (index)```");
            break;
    }
});
function inputHandler(message, args, serverQueue) {
    return __awaiter(this, void 0, void 0, function () {
        var voiceChannel, isPaused, permissions, list, playid, items, error_1, singleVideoInfo, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    voiceChannel = message.member.voice.channel;
                    if (!voiceChannel)
                        return [2 /*return*/, message.channel.send("You need to be in a voice channel to play music!")];
                    isPaused = serverQueue
                        ? serverQueue.connection.dispatcher.paused
                        : false;
                    if (isPaused) {
                        resume(message, serverQueue);
                    }
                    permissions = voiceChannel.permissionsFor(message.client.user);
                    if (!permissions.has("CONNECT") || !permissions.has("SPEAK"))
                        return [2 /*return*/, message.channel.send("I need the permissions to join and speak in your voice channel!")];
                    list = [];
                    if (!args.includes("https://www.youtube.com/playlist?list=")) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ytpl(args)];
                case 2:
                    playid = _a.sent();
                    items = playid.items;
                    list.push.apply(list, items);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.log(error_1);
                    message.channel.send(error_1);
                    return [3 /*break*/, 4];
                case 4: return [3 /*break*/, 11];
                case 5:
                    if (!args.includes("https://www.youtube.com/watch?v=")) return [3 /*break*/, 10];
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, ytdl.getInfo(args)];
                case 7:
                    singleVideoInfo = _a.sent();
                    list.push(singleVideoInfo.videoDetails);
                    return [3 /*break*/, 9];
                case 8:
                    error_2 = _a.sent();
                    console.log(error_2);
                    message.channel.send(error_2);
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 11];
                case 10:
                    message.channel.send("Invalid arguments, need to be either a youtube playlist link or a video link.");
                    _a.label = 11;
                case 11:
                    linkHandler(message, list, serverQueue, voiceChannel);
                    return [2 /*return*/];
            }
        });
    });
}
function skip(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("There is no song to be skipped!");
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to skip the music!");
    if (message.member.voice.channel.id != serverQueue.voiceChannel.id)
        return message.channel.send("You need to be in the same voice channel as the bot to skip the music.");
    serverQueue.songs.shift();
    play(message.guild.id, serverQueue.songs[0], message);
}
function stop(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("There is no songs to stop.");
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to stop the music!");
    if (message.member.voice.channel.id != serverQueue.voiceChannel.id)
        return message.channel.send("You need to be in the same voice channel as the bot to stop the music.");
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.destroy();
    serverQueue.songs.shift();
    play(message.guild.id, serverQueue.songs[0], message);
}
function pause(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("There is no music to pause.");
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to pause the music!");
    if (message.member.voice.channel.id != serverQueue.voiceChannel.id)
        return message.channel.send("You need to be in the same voice channel as the bot to pause the music.");
    serverQueue.connection.dispatcher.pause(true);
    return message.channel.send("Music paused.");
}
function resume(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("There is no music to resume.");
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to resume the music!");
    if (message.member.voice.channel.id != serverQueue.voiceChannel.id)
        return message.channel.send("You need to be in the same voice channel as the bot to resume the music.");
    if (serverQueue.connection.dispatcher.paused) {
        serverQueue.connection.dispatcher.resume();
        return message.channel.send("Music resumed.");
    }
    else {
        message.channel.send("Music isn't paused.");
    }
}
function play(guildId, song, message) {
    var serverQueue = queue.get(guildId);
    if (!song) {
        serverQueue.voiceChannel.leave();
        message.channel.send("Queue is empty, leaving the voice channel.");
        queue["delete"](guildId);
        return;
    }
    var dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", function () {
        serverQueue.songs.shift();
        play(guildId, serverQueue.songs[0], message);
    })
        .on("error", function (error) {
        console.error(error);
    });
    message.channel.send("Now playing: **" + song.title + "** | **" + song.duration + "**");
    serverQueue.nowPlaying = song.title;
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}
function linkHandler(message, list, serverQueue, voiceChannel) {
    return __awaiter(this, void 0, void 0, function () {
        var queueConstruct, _a, err_1, textToDisplay;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (serverQueue &&
                        message.member.voice.channel.id != serverQueue.voiceChannel.id)
                        return [2 /*return*/, message.channel.send("You need to be in the same voice channel as the bot to add new songs.")];
                    if (!!serverQueue) return [3 /*break*/, 5];
                    queueConstruct = new queueConstructor(voiceChannel);
                    songStatsFormat(queueConstruct, list);
                    queue.set(message.guild.id, queueConstruct);
                    message.channel.send("Added " + queueConstruct.songs.length + " " + (queueConstruct.songs.length > 1 ? "songs" : "song") + " to the queue!");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    _a = queueConstruct;
                    return [4 /*yield*/, voiceChannel.join()];
                case 2:
                    _a.connection = _b.sent();
                    queueConstruct.nowPlaying = queueConstruct.songs[0].title;
                    play(message.guild.id, queueConstruct.songs[0], message);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _b.sent();
                    console.log(err_1);
                    queue["delete"](message.guild.id);
                    return [2 /*return*/, message.channel.send(err_1)];
                case 4: return [3 /*break*/, 6];
                case 5:
                    textToDisplay = list.length >= 2
                        ? list.length + " songs added to the queue!"
                        : "**" + list[0].title + "** has been added to the queue!";
                    songStatsFormat(serverQueue, list);
                    message.channel.send(textToDisplay);
                    _b.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function songStatsFormat(queue, arr) {
    for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
        var item = arr_1[_i];
        item.url = item.shortUrl ? item.shortUrl : item.video_url;
        item.duration = item.durationSec
            ? timeParser(item.durationSec)
            : timeParser(item.lengthSeconds);
        queue.songs.push(item);
    }
}
function queueDisplayHandler(message, serverQueue, argsPage) {
    var queueLength = serverQueue.length;
    var maxSongsToDisplay = 10;
    var maxPages = Math.ceil(queueLength / maxSongsToDisplay);
    if (argsPage > maxPages || argsPage <= 0 || isNaN(argsPage))
        return message.channel.send("Invalid page number.");
    var startingPos = 10 * (argsPage - 1);
    var responseMsg = [];
    for (var i = 0; i < maxSongsToDisplay; i++) {
        if (!serverQueue[startingPos + i]) {
            break;
        }
        responseMsg.push("**" + (startingPos + i + 1) + " - " + serverQueue[startingPos + i].title + " | " + serverQueue[startingPos + i].duration + "** \n");
    }
    if (queueLength > maxSongsToDisplay) {
        responseMsg.push("Page " + argsPage + " of " + maxPages);
    }
    message.channel.send(responseMsg.join(""));
}
function removeMusic(queue, message, args) {
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to remove a song!");
    if (message.member.voice.channel.id != queue.voiceChannel.id)
        return message.channel.send("You need to be in the same voice channel as the bot to remove a song.");
    var removedSong = queue.songs.splice(args, 1);
    message.channel.send("Removed **" + removedSong[0].title + "** from the queue.");
    if (args === 0) {
        play(message.guild.id, queue.songs[0], message);
    }
}
function timeParser(time) {
    var minutes = Math.floor(time / 60);
    var seconds = time % 60;
    var finalTime = str_pad_left(minutes, "0", 2) + ":" + str_pad_left(seconds, "0", 2);
    return finalTime;
}
function str_pad_left(string, pad, length) {
    return (new Array(length + 1).join(pad) + string).slice(-length);
}
function nowPlaying(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("Nothing playing.");
    serverQueue.nowPlayingTimeLeft =
        (serverQueue.connection.dispatcher.streamTime -
            serverQueue.connection.dispatcher.pausedTime) /
            1000;
    message.channel.send("Now playing: **" + serverQueue.nowPlaying + "** | " + timeParser(serverQueue.nowPlayingTimeLeft.toFixed(0)) + "/" + serverQueue.songs[0].duration);
}
client.login(token);
