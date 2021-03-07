// *TODO*
// criar um comando de queue que mostre o título e duração da música com link (embed)
// mudar o nome do bot
// testar se ele pausa/"despausa" a música em mais de 1 servidor (tenho quase ctz que n)
// colocar remove nas músicas da queue
//
//
//
//
//
//
//
const Discord = require('discord.js');
const {
	prefix,
	token,
} = require('./config.json');
const ytdl = require('ytdl-core');

const client = new Discord.Client();

let vidData = require('vid_data');

const queue = new Map();

client.once('ready', () => console.log('Ready!'));

client.on('error', error => console.log('The WebSocket encountered an error:', error));

client.on('reconnecting', () => console.log('Reconnecting!'));

client.on('disconnect', () => console.log('Disconnect!'));

client.on('unhandledRejection', error => console.log('Unhandled promise rejection:'+ error));


client.on('message', async message => {
	if (message.author.bot || !message.content.startsWith(prefix)) return;
	let argsa = message.content.slice(prefix.length).trim().split(/ +/);

	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`)) {
		teste(message, argsa, serverQueue);		
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}queue`)) {
		let liista = queue.get(message.guild.id);
		liista.forEach(item=>{
			
		})
		console.log(liista.songs);
		message.channel.send('Lista :'+liista.songs.join('\n'))
	} else if (message.content.startsWith(`${prefix}pause`)) {
		pause(message, serverQueue);
	} else if (message.content.startsWith(`${prefix}resume`)) {
		resume(message, serverQueue);
	} else {
		message.channel.send('You need to enter a valid command!')
	}
});

async function teste(message, argsa, serverQueue) {
	const voiceChannel = message.member.voice.channel;
		if (!voiceChannel) message.channel.send('You need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(message.client.user);
		if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) message.channel.send('I need the permissions to join and speak in your voice channel!');

		 argsa.shift();
		
		 
			let pltry = (argsa.join(''));
			if(pltry.includes('playlist?list')){
				var list = [];
				console.log('é uma playlist');
				let playid = await vidData.get_playlist_videos(argsa.join(''));
				playid.forEach(id=>{
					list.push(`https://www.youtube.com/watch?v=${id}`);
				})
				console.log(list);
				if (!serverQueue) {
					const queueContruct = {
						textChannel: message.channel,
						voiceChannel: voiceChannel,
						connection: null,
						songs: [],
						volume: 3,
						playing: true,
					};
					var song;
					let xd = JSON.stringify(list)
					list.forEach(item=>{
						queueContruct.songs.push(item);
					});
					console.log(queueContruct.songs)
				
					queue.set(message.guild.id, queueContruct);
					try {
						var connection = await voiceChannel.join();
						queueContruct.connection = connection;
						play(message.guild, queueContruct.songs[0]);
					} catch (err) {
						console.log(err);
						queue.delete(message.guild.id);
						return message.channel.send(err);
					}
				
				
				}else{
				
					serverQueue.songs.push(song);
					console.log(serverQueue.songs);
					return message.channel.send(`$ has been added to the queue!`);
				}
				
			}else{
				if(!pltry.includes('https://www.youtube.com/watch?v=')){
					message.channel.send('Invalid arguments, need to be either a youtube playlist link or a video link.');
					return;
				}
				
				if (!serverQueue) {
				const queueContruct = {
					textChannel: message.channel,
					voiceChannel: voiceChannel,
					connection: null,
					songs: [],
					volume: 3,
					playing: true,
				};
					console.log(pltry);
					console.log('é um vídeo solo');
					const song = pltry;
					queueContruct.songs.push(song);
					queue.set(message.guild.id, queueContruct);
				try {
						var connection = await voiceChannel.join();
						queueContruct.connection = connection;
						play(message.guild, queueContruct.songs[0]);
					} catch (err) {
						console.log(err);
						queue.delete(message.guild.id);
						return message.channel.send(err);
					}
				
			}else{
								
				serverQueue.songs.push(song);
				console.log(serverQueue.songs);
				return message.channel.send(`$ has been added to the queue!`);
			}
		}
		
}

function skip(message, serverQueue) {
	if (!message.member.voice.channel) message.channel.send('You have to be in a voice channel to skip the music!');
	if (!serverQueue) message.channel.send('There is no song that I could skip!');
	serverQueue.songs.shift();
	play(message.guild, serverQueue.songs[0]);
}


function stop(message, serverQueue) {
	if (!message.member.voice.channel) message.channel.send('You have to be in a voice channel to stop the music!');
	serverQueue.songs = [];
	serverQueue.connection.dispatcher.destroy();
	serverQueue.songs.shift();
	play(message.guild, serverQueue.songs[0]);
}

function pause(message, serverQueue){
	serverQueue.connection.dispatcher.pause();
	return message.channel.send('Music paused.');
};

function resume(message, serverQueue){
	serverQueue.connection.dispatcher.resume();
	return message.channel.send('Music resumed.');
};

async function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection.play(ytdl(song , { requestOptions: maxReconnects= '5' }).on('response', debug=> console.log(debug.statusCode)).on('error', debug=> console.log('Response : '+debug)).on('info', debug=> console.log(debug.title)))
		.on('finish', () => {
			console.log('Music ended!');
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('debug', debug=> {
			console.log(debug);
		})
		.on('error', error => {
			console.error(error);
		});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);