// *TODO*
// criar um comando de queue que mostre o título e duração da música com link (embed) (50% done)
// mudar o nome do bot
// testar se ele pausa/"despausa" a música em mais de 1 servidor (tenho quase ctz que n)
// colocar remove nas músicas da queue
const Discord = require('discord.js');
const {
	prefix,
	token,
} = require('./config.json');
const ytdl = require('ytdl-core');

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
		inputHandler(message, argsa, serverQueue);		
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
	}
});

async function inputHandler(message, argsa, serverQueue) {
	const voiceChannel = message.member.voice.channel;
		if (!voiceChannel) message.channel.send('You need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) message.channel.send('I need the permissions to join and speak in your voice channel!');
		let list = [];
			let messageArgs = argsa[1].toString();
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
		for(const item of list){
			item.url = item.shorturl ? item.shorturl : item.video_url;
			serverQueue.songs.push(item);
			message.channel.send(`**${item.title}** has been added to the queue!`);
		}
		
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

//        TO DO

/* function removeMusic(queue){
	queue.songs
} */

function timeParser(time){
	let minutes = Math.floor(time/60);
	let seconds = time %60;
	var finalTime = str_pad_left(minutes,'0',2)+':'+str_pad_left(seconds,'0',2);
	return finalTime;
}

function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

client.login(token);