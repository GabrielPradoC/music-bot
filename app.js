// *TODO*
// criar um comando de queue que mostre o título e duração da música com link (embed) (50% done)
// mudar o nome do bot
// testar se ele pausa/"despausa" a música em mais de 1 servidor (tenho quase ctz que n)
// colocar remove nas músicas da queue
const Discord = require('discord.js');

const {
	prefix,
	token,
	spotify_client_id,
	spotify_client_secret,
	youtube_api_key
} = require('./config.json');

const ytdl = require('ytdl-core');

const axios = require('axios');

const google = require('googleapis');

const youtube = new google.youtube_v3.Youtube({
	version: 'v3',
	auth: youtube_api_key
})

const client = new Discord.Client();

const vidData = require('vid_data');

const ytpl = require('ytpl');

const queue = new Map();

client.once('ready', () => console.log(`Ready! ${client.user.username}`));

client.on('error', error => console.log('The WebSocket encountered an error:'+ error));

client.on('reconnecting', () => console.log('Reconnecting!'));

client.on('disconnect', () => console.log('Disconnect!'));

client.on('unhandledRejection', error => console.log('Unhandled promise rejection:'+ error));


client.on('message', async message => {
	if (message.author.bot || !message.content.startsWith(prefix)) return;
	let argsa = message.content.slice(prefix.length).trim().split(/ +/);

	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`)) {
		argsa.shift();
		inputHandler(message, argsa.join(' '), serverQueue);		
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}queue`)) {
		queueDisplayHandler(message, serverQueue.songs);
	} else if (message.content.startsWith(`${prefix}pause`)) {
		pause(message, serverQueue);
	} else if (message.content.startsWith(`${prefix}resume`)) {
		resume(message, serverQueue);
	} else if(message.content.startsWith(`${prefix}np`)){
		message.channel.send(`Now playing: **${serverQueue.nowPlaying}**`);
	}else if(message.content.startsWith(`${prefix}remove`)){
		if(argsa[1] <= 0 || !argsa[1]) return message.channel.send(`Invalid index.`);
		serverQueue.songs = removeMusic(serverQueue, message, argsa[1]-1);
	}
});

async function inputHandler(message, argsa, serverQueue) {
	const voiceChannel = message.member.voice.channel;
		if (!voiceChannel) message.channel.send('You need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) message.channel.send('I need the permissions to join and speak in your voice channel!');
		let list = [];
			let messageArgs = argsa;
			if(messageArgs.includes('playlist?list')){
				const playid = await ytpl(messageArgs)
				let { items } = playid;
				for(const obj of items){
					list.push(obj);
				};
				linkHandler(message, list, serverQueue, queue, voiceChannel);
			}else if(messageArgs.includes('https://www.youtube.com/watch?v=')){
				const singleVideoInfo = await ytdl.getInfo(messageArgs);
				list.push(singleVideoInfo.videoDetails);
				linkHandler(message, list, serverQueue, queue, voiceChannel);
			}else if(messageArgs.includes('https://open.spotify.com/')){			
				spotifyLinkHandler(messageArgs, message, serverQueue);
			}else{
				message.channel.send('Invalid arguments, need to be either a youtube playlist link or a video link.');
				return;
			}		
}

function skip(message, serverQueue) {
	if (!message.member.voice.channel) message.channel.send('You have to be in a voice channel to skip the music!');
	if (!serverQueue) message.channel.send('There is no song that I could skip!');
	serverQueue.songs.shift();
	play(message.guild, serverQueue.songs[0], message);
}


function stop(message, serverQueue) {
	if (!message.member.voice.channel) message.channel.send('You have to be in a voice channel to stop the music!');
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.destroy();
	serverQueue.songs.shift();
	play(message.guild, serverQueue.songs[0], message);
}

function pause(message, serverQueue){
	serverQueue.connection.dispatcher.pause();
	return message.channel.send('Music paused.');
};

function resume(message, serverQueue){
	serverQueue.connection.dispatcher.resume();
	return message.channel.send('Music resumed.');
};

async function play(guild, song, message) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		message.channel.send('Queue is empty, leaving the voice channel.');
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection.play(ytdl(song.url)/* .on('response', debug=> console.log(debug.statusCode)).on('error', debug=> console.log('Response : '+debug)).on('info', debug=> console.log(debug.title)) */)
		.on('finish', () => {
			console.log('Music ended!');
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0], message);
		})
		.on('debug', debug=> {
			console.log(debug);
		})
		.on('error', error => {
			console.error(error);
		});

	message.channel.send(`Now playing: **${song.title}** | **${timeParser(song.duration)}**`);
	serverQueue.nowPlaying = song.title;
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

async function linkHandler(message, list, serverQueue,queue, voiceChannel){
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			nowPlaying: null,
			songs: [],
			volume: 3,
			playing: true,
		};
		for(const item of list){
			item.url = item.shortUrl ? item.shortUrl : item.video_url;
			item.duration = item.durationSec ? item.durationSec : item.lengthSeconds;
			queueConstruct.songs.push(item);
		}
		queue.set(message.guild.id, queueConstruct);
		message.channel.send(`Added ${queueConstruct.songs.length} ${queueConstruct.songs.length>1? 'musics': 'music'} to the queue!`);
		try {
			let connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			queueConstruct.nowPlaying = queueConstruct.songs[0].title;
			play(message.guild, queueConstruct.songs[0], message);
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}	
	}else{
		let textToDisplay = list.length >= 2? `${list.length} songs added to the queue!` : `**${list[0].title}** has been added to the queue!`;
		for(const item of list){
			item.url = item.shorturl ? item.shorturl : item.video_url;
			item.duration = item.durationSec ? item.durationSec : item.lengthSeconds;
			serverQueue.songs.push(item);
		}
		message.channel.send(textToDisplay);
	}
}

async function queueDisplayHandler(message, queue){
	let responseMsg = [];
	let iterable = 1;
	for(const item of queue){
		responseMsg.push(`**${iterable} - ${item.title}**\n`);
		iterable++;
	}
	message.channel.send(responseMsg.join(''));
}

function removeMusic(queue, message, args){
	let removedSong = queue.songs.splice(args, 1);
	message.channel.send(`Removed **${removedSong[0].title}** from the queue.`);
	if(removedSong[0].title === queue.nowPlaying){
		play(message.guild, queue.songs[0], message);
	}
	return queue.songs;
}

function timeParser(time){
	let minutes = Math.floor(time/60);
	let seconds = time %60;
	var finalTime = str_pad_left(minutes,'0',2)+':'+str_pad_left(seconds,'0',2);
	return finalTime;
}

function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

async function spotifySingleTrackHandler(spotifyID, message, queue){
	const authResponse = await axios({
		method: 'post',
		url: 'https://accounts.spotify.com/api/token',
		data: 'grant_type=client_credentials',
		headers: {
			'Authorization': 'Basic ' + (Buffer.from(`${spotify_client_id}:${spotify_client_secret}`).toString('base64')),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		json: true
	})
	.catch(err=>{
		console.log(err);
	})

	if(authResponse.status === 200){
		const dataResponse = await axios({
			method: 'get',
			url: `https://api.spotify.com/v1/tracks/${spotifyID}`,
			headers: {
				'Authorization': `Bearer ${authResponse.data.access_token}`,
			},
			json: true
		})
		const spotifyData = dataResponse.data;
		const musicName = `${spotifyData.name}`;
		ytSearch(musicName, message, queue);		
	}else{
		message.channel.send('Couldn\'t fetch the track, try again later');
		console.log(authResponse.status+' An error ocurred while fetching a track!');
	}
}

async function spotifyPlaylistHandler(playlistId, message, serverQueue){
	
		const authResponse = await axios({
		method: 'post',
		url: 'https://accounts.spotify.com/api/token',
		data: 'grant_type=client_credentials',
		headers: {
			'Authorization': 'Basic ' + (Buffer.from(`${spotify_client_id}:${spotify_client_secret}`).toString('base64')),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		json: true
	}).catch((err)=>{
		console.log(authResponse.status+' '+err);
	})


	if(authResponse.status === 200){
			const dataResponse = await axios({
			method: 'get',
			url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
			params: {
				market: 'BR',
				fields: 'items(track(name%2C%20artists(name)))',
				limit: 99
			},
			headers: {
				'Authorization': `Bearer ${authResponse.data.access_token}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			json: true
		}).catch((err)=>{
			console.log(dataResponse.status+' '+err);
		});
		const spotifyData = dataResponse.data;
		const trackList = [];
		console.log(spotifyData.items.length);
		for(const track of spotifyData.items){
			let searchRes = ytSearch(track.track.name, message, serverQueue, 1)
			trackList.push(searchRes);
		}
		console.log(trackList);
		return;
		const voiceChannel = message.member.voice.channel;
		if (!voiceChannel) message.channel.send('You need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) message.channel.send('I need the permissions to join and speak in your voice channel!');
		linkHandler(message, trackList, serverQueue, queue, voiceChannel);
	}else{
		message.channel.send('Couldn\'t fetch the playlist, try again later');
		console.log(authResponse.status+' An error ocurred while fetching a track!');
	}
}

/////////////////////////////////////////////  need to change this later

function ytSearch(searchString, message,  queue, shouldReturn = 0){
	let results = youtube.search.list({
		part: 'snippet',
		q: searchString,
		maxResults: 1
	}, async function(err, data){
		if(err) console.log(err);
		if(data){
			let ytSearchQ = await axios({
				method: 'get',
				url: data.request.responseURL,
				json: true
			})
			const video = ytSearchQ.data.items;
			let string = `https://www.youtube.com/watch?v=${video[0].id.videoId}`;
			console.log(string)
			if(shouldReturn === 1){				
				return string;
			}	
			inputHandler(message, string, queue);
		}
	})
}

///////////////////////////////////////////////////
function spotifyLinkHandler(link, message, queue){
	if(link.includes('/track/')){
	let trackId = link.slice(link.lastIndexOf('track/')+6, link.indexOf('?si'));
		spotifySingleTrackHandler(trackId, message, queue);
	}else if(link.includes('/playlist/')){
		let playlistId = link.slice(link.lastIndexOf('playlist/')+9, link.indexOf('?si'));
		spotifyPlaylistHandler(playlistId, message, queue)
	}
}

client.login(token);