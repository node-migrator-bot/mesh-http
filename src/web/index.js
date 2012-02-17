require('./history');

var utils = require('./utils'),
_    = require('underscore'),
Url = require('url'),
logger = require('mesh-winston').loggers.get('history.core'),
beanpoll = require('beanpoll');


beanpoll.Response.prototype.redirect = function(location) {
	this.headers({ redirect: location });
	this.end();
}

exports.plugin = function(router)
{
	var currentChannel,
	pushedReady = false;




	function normalizeChannel(channel)
	{
		return router.parse.stringifyPaths(router.parse.parseChannel(channel).paths)
	}


	var prevChannel;


	function pullState(channel, data)
	{
		if(channel.substr(0,1) != '/') channel = '/' + channel;

		var parts = Url.parse(channel, true);

		if(parts.pathname == prevChannel)
		{
			console.log('alreading viewing %s', prevChannel);
			return
		}


		prevChannel = parts.pathname;

		var hostname = window.location.hostname,
		hostnameParts = hostname.split('.');
		subdomain = hostnameParts.length > 2 ? hostnameParts.shift() : undefined;


		logger.info('navigate to ' + parts.pathname);

		router.request(parts.pathname).query(_.extend(parts.query, data, true)).headers({ subdomain: subdomain, stream: true }).success(function(stream)
		{

			logger.info('dumping stream data');

			var buffer = '', response = {};

			stream.dump({
				error: function(err) {
					console.log(err.stack);
				},
				headers: function(res)
				{
					response = res;

					if(res.redirect)
					{
						router.push('redirect', res.redirect);
					}
				},
				data: function(chunk) {
					buffer += chunk
				},
				end: function() {
					if(response.redirect || response.dontPrint) return;
					
					document.body.innerHTML = buffer;
				}
			})
		}).pull();
	}


	window.onpopstate = function(e)
	{

		var state = e.state;     

		if(!state) return;

		currentChannel = state.channel;       

		router.push('track/pageView', { page: state.channel });
                                 
		pullState(state.channel || state.hash, state.data);
	}  

	/**
	 */

	router.on({

		/**
		 */

		'push redirect': function(ops)
		{                                           

			var channel, data;

			if(typeof ops == 'string')
			{
				channel = ops;
				data = {};
				ops = {};
			}
			else
			{
				channel = ops.channel;
				data = ops.data;
			}

			if(!channel) return;

			var urlParts = Url.parse(channel, true);   



			var uri = urlParts.pathname,
			newChannel = normalizeChannel(uri);

			data = _.extend(urlParts.query, data);


			if(router.request(uri).type('pull').tag('http', true).hasListeners())
			{	
				if(newChannel == currentChannel) return;

                                                      
				logger.info('redirect to ' + channel);


				window.history.pushState({ data: data, channel: channel } , null, ('/' + channel).replace(/\/+/g,'/'));     

				router.push('track/pageView', { page: channel });
			}

			// else
			{

				if(ops.pull === undefined || ops.pull == true)
				//not a viewable item? pull it. might do something else that's fancy...
				pullState(channel, data);	
			}


		},

		/**
		 */

		'pull load/*': function(req, res, mw) {
			$(document).ready(function() {
				mw.next();
			});
		},

		/**
		 */

		'push -one init': function() {
			logger.info('app ready');


			var hasListeners = router.request(window.location.pathname).tag('static', false).type('pull').hasListeners();


			router.push('redirect', window.location.pathname + window.location.search);
			router.push('history/ready');   


			router.on({
				'pull history/ready': function(req, res) {
					res.end(true);
				}
			})
		}
	})
}