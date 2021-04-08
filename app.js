const Discord = require('discord.js');

const token = process.env.AUTH;

const prefix = process.env.PREFIX;

const ytdl = require('ytdl-core');

const client = new Discord.Client();

const ytpl = require('ytpl');

class queueConstructor{
	constructor(vc){
		this.voiceChannel = vc;
		this.connection = null;
		this.nowPlaying = null;
		this.nowPlayingTimeLeft = null;
		this.songs = [];
		this.volume = 3;
		this.playing = true;
	}
}

const queue = new Map();

client.once('ready', () => {
	console.log(`Ready! ${client.user.username}`);
});

client.on('error', error => console.log('The WebSocket encountered an error:'+ error));

client.on('reconnecting', () => console.log('Reconnecting!'));

client.on('disconnect', () => console.log('Disconnect!'));


client.on('message', message => {
	if (message.author.bot || !message.content.startsWith(prefix)) return;
	let args = message.content.slice(prefix.length).trim().split(/ +/);
	const serverQueue = queue.get(message.guild.id);
	switch(args[0]){
		case 'play':
			args.shift();
			inputHandler(message, args.join(' '), serverQueue);	
			break;
		case 'skip':
			skip(message, serverQueue);
			break;
		case 'stop':
			stop(message, serverQueue);
			break;
		case 'queue':
			args.shift();
			queueDisplayHandler(message, serverQueue.songs, args[0]);
			break;
		case 'pause':
			pause(message, serverQueue);
			break;
		case 'resume':
			resume(message, serverQueue);
			break;
		case 'np':
			nowPlaying(message, serverQueue);
			break;
		case 'remove':
			if (!serverQueue) return message.channel.send('There\'s no songs in the queue.');
			if(args[1] <= 0 || !args[1] || args[1] > serverQueue.songs.length || isNaN(args[1])) return message.channel.send(`Invalid index.`);
			removeMusic(serverQueue, message, args[1]-1);
			break;
		case 'help':
			message.channel.send(`\`\`\`Commands:\n${prefix}play (youtube link)\n${prefix}skip\n${prefix}stop\n${prefix}queue\n${prefix}pause\n${prefix}resume\n${prefix}np\n${prefix}remove (index)\`\`\``)
			break;
	}
});



async function inputHandler(message, args, serverQueue) {
	const voiceChannel = message.member.voice.channel;
		if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
		let isPaused = false;
		if(serverQueue) isPaused = serverQueue.connection.dispatcher.paused;		
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) return message.channel.send('I need the permissions to join and speak in your voice channel!');
		let list = [];
			if(args.includes('https://www.youtube.com/playlist?list=')){
				try {
					const playid = await ytpl(args)
					let { items } = playid;
					for(const obj of items){
						list.push(obj);
					}
				} catch (error) {
					console.log(error);
					message.channel.send(error);
				}
				linkHandler(message, list, serverQueue, queue, voiceChannel);
			}else if(args.includes('https://www.youtube.com/watch?v=')){
				try {
					const singleVideoInfo = await ytdl.getInfo(args);
					list.push(singleVideoInfo.videoDetails);
				} catch (error) {
					console.log(error);
					message.channel.send(error);
				}
				linkHandler(message, list, serverQueue, queue, voiceChannel);
			}else if(isPaused){
				resume(message, serverQueue);
			}else{
				message.channel.send('Invalid arguments, need to be either a youtube playlist link or a video link.');
			}		
}

function skip(message, serverQueue) {
	if (!serverQueue) return message.channel.send('There is no song to be skipped!');
	if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to skip the music!');
	if(message.member.voice.channel.id != serverQueue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to skip the music.');
	serverQueue.songs.shift();
	play(message.guild.id, serverQueue.songs[0], message);
}

function stop(message, serverQueue) {
	if(!serverQueue) return message.channel.send('There is no songs to stop.');
	if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
	if(message.member.voice.channel.id != serverQueue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to stop the music.');
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.destroy();
	serverQueue.songs.shift();
	play(message.guild.id, serverQueue.songs[0], message);
}

function pause(message, serverQueue){
	if(!serverQueue) return message.channel.send('There is no music to pause.');
	if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to pause the music!');
	if(message.member.voice.channel.id != serverQueue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to pause the music.');
	serverQueue.connection.dispatcher.pause(true);
	return message.channel.send('Music paused.');
}

function resume(message, serverQueue){
	if(!serverQueue) return message.channel.send('There is no music to resume.');
	if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to resume the music!');
	if(message.member.voice.channel.id != serverQueue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to resume the music.');
	if(serverQueue.connection.dispatcher.paused){
		serverQueue.connection.dispatcher.resume();
		return message.channel.send('Music resumed.');
	}else{
		message.channel.send('Music isn\'t paused.')
	}	
}

function play(guildId, song, message) {
	const serverQueue = queue.get(guildId);
	if (!song) {
		serverQueue.voiceChannel.leave();
		message.channel.send('Queue is empty, leaving the voice channel.');
		queue.delete(guildId);
		return;
	}

	const dispatcher = serverQueue.connection.play(ytdl(song.url))
		.on('finish', () => {
			serverQueue.songs.shift();
			play(guildId, serverQueue.songs[0], message);
		})
		.on('error', error => {
			console.error(error);
		});

	message.channel.send(`Now playing: **${song.title}** | **${song.duration}**`);
	serverQueue.nowPlaying = song.title;
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

async function linkHandler(message, list, serverQueue,queue, voiceChannel){
	if(serverQueue && message.member.voice.channel.id != serverQueue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to add new songs.');
	if (!serverQueue) {
		const queueConstruct = new queueConstructor(voiceChannel);
		songStatsFormat(queueConstruct, list)
		queue.set(message.guild.id, queueConstruct);
		message.channel.send(`Added ${queueConstruct.songs.length} ${queueConstruct.songs.length>1? 'songs': 'song'} to the queue!`);
		try {
			queueConstruct.connection = await voiceChannel.join();
			queueConstruct.nowPlaying = queueConstruct.songs[0].title;
			play(message.guild.id, queueConstruct.songs[0], message);
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}	
	}else{
		let textToDisplay = list.length >= 2? `${list.length} songs added to the queue!` : `**${list[0].title}** has been added to the queue!`;
		songStatsFormat(serverQueue, list);
		message.channel.send(textToDisplay);
	}
}

function songStatsFormat(queue, arr){
	for(const item of arr){
		item.url = item.shortUrl ? item.shortUrl : item.video_url;
		item.duration = item.durationSec ? timeParser(item.durationSec) : timeParser(item.lengthSeconds);
		queue.songs.push(item);
	}
}

function queueDisplayHandler(message, queue, argsPage = 1){
	const queueLength = queue.length;
	const maxSongsToDisplay = 10;	
	const maxPages = Math.ceil(queueLength/ maxSongsToDisplay);
	if(argsPage> maxPages || argsPage<= 0 || isNaN(argsPage)) return message.channel.send('Invalid page number.');	
	const startingPos = 10*(argsPage-1);	
	let responseMsg = [];	
	for(let i = 0;i<maxSongsToDisplay;i++){
			if(!queue[startingPos+i]){ break }
			responseMsg.push(`**${startingPos+i+1} - ${queue[startingPos+i].title} | ${queue[startingPos+i].duration}** \n`);
	}
	if(queueLength> maxSongsToDisplay){
		responseMsg.push(`Page ${argsPage} of ${maxPages}`);
	}
	message.channel.send(responseMsg.join(''));
}

function removeMusic(queue, message, args){
	if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to remove a song!');
	if(message.member.voice.channel.id != queue.voiceChannel.id) return message.channel.send('You need to be in the same voice channel as the bot to remove a song.');
	let removedSong = queue.songs.splice(args, 1);
	message.channel.send(`Removed **${removedSong[0].title}** from the queue.`);
	if(args === 0){
		play(message.guild.id, queue.songs[0], message);
	}
}

function timeParser(time){
	let minutes = Math.floor(time/60);
	let seconds = time %60;
	let finalTime = str_pad_left(minutes,'0',2)+':'+str_pad_left(seconds,'0',2);
	return finalTime;
}

// eslint-disable-next-line camelcase
function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

function nowPlaying(message, serverQueue){
	if(!serverQueue) return message.channel.send('Nothing playing.');
	serverQueue.nowPlayingTimeLeft = (serverQueue.connection.dispatcher.streamTime - serverQueue.connection.dispatcher.pausedTime) /1000;
	message.channel.send(`Now playing: **${serverQueue.nowPlaying}** | ${timeParser(serverQueue.nowPlayingTimeLeft.toFixed(0))}/${serverQueue.songs[0].duration}`);
}

client.login(token);