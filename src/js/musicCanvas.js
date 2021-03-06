/**
 * Created by MajorKilling on 2017/4/10.
 */


var Visualizer = function() {
	this.file = null;
	this.fileName = null;
	this._audioCtx = null;
	this._gainNode = null;
	this._analyser = null ;
	this._source = null;
	this._buffer =null;
	this._bufferSavedList =[];
	this._playListPositon = 0;
	this._callbacks = {
		loading: function(){},
		playing: function(){},
		drawing: function(){},
		ended: function(){}
	};
	this._quietime = 0;
	this._realplayedtime = 0;
	this._balance = 0;
	this._playing = false;
	this._loop = false;
	this.autoPlay = false;
	this.animationId  = null;
};

Visualizer.prototype = {
	init:function (bufferArray,loadedCallback) {
		this._prepareAPI();
		if(bufferArray===null || bufferArray==='undefined'){
			console.log('Your must put ArrayBuffer Object!!!');
			return 0;
		}else if(bufferArray instanceof ArrayBuffer){
			this._prepareData(bufferArray,loadedCallback);
		}else{
			console.log('Your must put ArrayBuffer Object!!!');
			return 0;
		}
	},
	_prepareAPI:function () {
		window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
		window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
		try {
			this._audioCtx = new AudioContext();
			
			this._gainNode = this._audioCtx.createGain();
			this._analyser = this._audioCtx.createAnalyser();
			
			this._analyser.connect(this._gainNode);
			this._gainNode.connect(this._audioCtx.destination);
			
		} catch (e) {
			alert('你的浏览器不支持AudioContext-!_!-');
			console.log(e);
		}
	},
	_saveIntoBufList:function (newBuffer) { //buffer缓存列表
		var that = this;
		if(that._bufferSavedList.length>=3){
			that._bufferSavedList.shift();
			that._bufferSavedList.push(newBuffer);
		}else{
			that._bufferSavedList.push(newBuffer);
		}
		that._playListPositon = that._bufferSavedList.length-1;
	},
	_prepareData:function (bufferArray,loadedCallback) {
		//准备音频数据
		var that = this;
		that._callbacks.loading();
		
		var error = function (error) { console.error("Failed to decode:", error);
		};
		console.log('decoding.....');
		that._audioCtx.decodeAudioData(bufferArray,function (buffer) {
			that._buffer = buffer;
			that._saveIntoBufList(buffer);
			if(loadedCallback !=null && loadedCallback instanceof Function){
				loadedCallback();
			}
			console.log('decoded scuessful');
			that.play(0);
		}, error);
	},
	_playPrve:function (){
		var that = this;
		that.stop();
		that._playListPositon--;
		if(that._playListPositon<=0){
			that._playListPositon=0;
		}
		that._playToListIndex(that._playListPositon);
	},
	_playNext:function () {
		var that = this;
		that.stop();
		that._playListPositon++;
		if(that._playListPositon>=that._bufferSavedList.length-1){
			that._playListPositon=that._bufferSavedList.length-1;
		}
		that._playToListIndex(that._playListPositon);
	},
	_playToListIndex:function (INDEX) {
		var that = this;
		if(that._bufferSavedList[INDEX]){
			var audioBufferSouce= that._audioCtx.createBufferSource();
			that._buffer = that._bufferSavedList[INDEX];
			audioBufferSouce.buffer = that._buffer;
			audioBufferSouce.connect(that._analyser);
			
			that._realplayedtime = typeof position !== 'undefined' ? position : that._realplayedtime;
			that._quietime = that._audioCtx.currentTime - that._realplayedtime;
			audioBufferSouce.start(0, that._realplayedtime);
			that._source = audioBufferSouce;
			
			that._playing = true;
			that._callbacks.playing();
			that._drawSpectrum();
		}
	},
	play:function (position){//播放，带有当前播放时间位置的参数，单位为秒
		var that = this;
		if(that._playing){
			that.pause();
		}
		if(that._buffer){
			var audioBufferSouce= that._audioCtx.createBufferSource();
			audioBufferSouce.buffer = that._buffer;
			audioBufferSouce.connect(that._analyser);
			
			that._realplayedtime = typeof position !== 'undefined' ? position : that._realplayedtime;
			that._quietime = that._audioCtx.currentTime - that._realplayedtime;
			audioBufferSouce.start(0, that._realplayedtime);
			that._source = audioBufferSouce;
			
			
			that._playing = true;
			that._callbacks.playing();
			that._drawSpectrum();
		}
	},
	_drawSpectrum:function(){//绘图函数
		var that = this;
		var drawMeter = function(){
			var array = new Uint8Array(that._analyser.frequencyBinCount);
			that._analyser.getByteFrequencyData(array);
			
			that.animationId = requestAnimationFrame(drawMeter);
			//canvas画画就在drawing函数里面弄
			that._callbacks.drawing(that._updatePlayedtime(),array);
		};
		// that.animationId = requestAnimationFrame(drawMeter);
		drawMeter();
	},
	pauseAnimation:function(){
		window.cancelAnimationFrame(this.animationId);
	}, //暂停绘图
	stop: function() {
		this.pauseAnimation();
		this._silence();
		this._realplayedtime = 0;
	}, //停止播放
	pause: function(){
		var that = this;
		if(!that._playing){
			that.play(that._realplayedtime);
			return;
		}
		that.pauseAnimation();
		that._silence();
		that._updatePlayedtime();
	}, //暂停播放
	_silence: function(){
		if(this._source){
			this._source.stop(0);
			this._source = null;
		}
		this._playing = false;
	}, //静音
	_updatePlayedtime: function() {
		var that=this;
		this._realplayedtime = this._audioCtx.currentTime - this._quietime;
		if(this._realplayedtime >= this.duration() && this._playing) {
			if(this._loop) {
				this.play(0);
			} else {
				that.pauseAnimation();
				that._source.disconnect();
				that.stop();
				that._callbacks.ended();
			}
		}
		
		return this._realplayedtime;
	}, //更新播放时间
	seekToTime: function(percent) {
		// Make sure the right range
		var that = this;
		var time =percent*that.duration();
		time = Math.min(time, that.duration());
		time = Math.max(time, 0);
		that.play(time);
	}, //快进到某个某个播放时间点
	setVolume: function(volume) {
		this._gainNode.gain.value = volume/100;
	}, //设置音量
	duration:function () {
		return this._buffer.duration;
	}, //该函数返回整个音频的时间长度
	addEventListener: function(event, callback) {
		this._callbacks[event] = callback;
	} //注册全局回调事件函数，外部调用
}

//初始化dom,初始化播放控件
function initCanvasDom(audioapi) {
	var AudioCanvas = function () {
		this.acRangeLeft= null;
		this.acRangeWidth= null;
		this.acOriginWidth= 720;
		this.acOriginHeight= 405;
		
		this.lockFlag=true;
		this.oldState=false;
		this.listenTime=null;
		this.fullScreenEvent={
			fullchange:function () {}
		};
		
		this.acPlayBtn= null;
		this.acplayed= null;
		this.acVolValue= 1;
		this.acVolBar= null;
		
		this.acIsPlay= true;
		this.acQuiet= false;
		this.clickDown= false;
		this.timeMovePercent = null;
		this.clickTimePos = null;
		this.onlyClick= false;
		this.timeOut= null;
	};
	AudioCanvas.prototype={
		_getElementRealLeft:function (element) {
			var actualLeft = element.offsetLeft;
			var current = element.offsetParent;
			while (current !== null){
				actualLeft += current.offsetLeft;
				current = current.offsetParent;
			}
			return actualLeft;
		},
		_getElementLeft:function (element) {
			return element.offsetLeft;
		},
		_createMusicCANVASDom:function (boxID,options) {
			var maxBox = document.createElement('section');
			maxBox.setAttribute('class','audioCanvas');
			
			if(options && options.size && options.size instanceof Object){
				this.acOriginWidth = options.size.width;
				this.acOriginHeight = options.size.height;
			}
			maxBox.style.width = this.acOriginWidth + 'px';
			maxBox.style.height = this.acOriginHeight + 'px';
			
			var canvas = document.createElement('canvas');
			canvas.setAttribute('id','MusicCanvas');
			canvas.width=this.acOriginWidth;
			canvas.height=this.acOriginHeight;
			canvas.innerHTML='你的浏览器不支持canvas!';
			canvas.style.backgroundColor = '#0f0f0f';
			maxBox.appendChild(canvas);
			
			var ctrlBox = document.createElement('div');
			ctrlBox.setAttribute('class','audioCanvas_ctrl');
			var acRangeArea = document.createElement('div');
			acRangeArea.setAttribute('class','acRangeArea');
			var acRange = document.createElement('p');
			acRange.setAttribute('class','acRange');
			var acplayed = document.createElement('span');
			acplayed.setAttribute('class','acplayed');
			var seekBtn = document.createElement('span');
			seekBtn.setAttribute('class','seekBtn');
			acplayed.appendChild(seekBtn);
			acRange.appendChild(acplayed);
			acRangeArea.appendChild(acRange);
			ctrlBox.appendChild(acRangeArea);
			
			var acBtnArea = document.createElement('div');
			acBtnArea.setAttribute('class','acBtnArea');
			var acplay = document.createElement('span');
			acplay.setAttribute('id','acplay')
			acplay.setAttribute('class','glyphicon glyphicon-play')
			acBtnArea.appendChild(acplay);
			
			var acVolbox = document.createElement('div');
			acVolbox.setAttribute('class','acVolbox')
			var acVolbtn = document.createElement('span');
			acVolbtn.setAttribute('id','acVolbtn')
			acVolbtn.setAttribute('class','glyphicon glyphicon-volume-up')
			var acVolBarBox = document.createElement('span');
			acVolBarBox.setAttribute('class','acVolBarBox')
			var acVolBarbg = document.createElement('span');
			acVolBarbg.setAttribute('class','acVolBarbg')
			acVolBarBox.appendChild(acVolBarbg);
			var acVolBar = document.createElement('span');
			acVolBar.setAttribute('class','acVolBar')
			var acVolpoint = document.createElement('span');
			acVolpoint.setAttribute('class','acVolpoint')
			acVolBar.appendChild(acVolpoint);
			acVolBarBox.appendChild(acVolBar);
			acVolbtn.appendChild(acVolBarBox);
			acVolbox.appendChild(acVolbtn);
			
			var acTime = document.createElement('div');
			acTime.setAttribute('class','acTime')
			var acPlayedTime = document.createElement('span');
			acPlayedTime.setAttribute('class','acPlayedTime')
			acPlayedTime.innerHTML='00:00';
			acTime.appendChild(acPlayedTime);
			var mmspan = document.createElement('span');
			mmspan.innerHTML=' / ';
			acTime.appendChild(mmspan);
			var acFullTime = document.createElement('span');
			acFullTime.setAttribute('class','acFullTime')
			acFullTime.innerHTML='00:00';
			acTime.appendChild(acFullTime);
			
			acBtnArea.appendChild(acVolbox);
			acBtnArea.appendChild(acTime);
			
			if(options !== 'undefined' && options instanceof Object){
				if(options.needPreNext){
					var acPreNextArea = document.createElement('div');
					acPreNextArea.setAttribute('class','acPreNextArea')
					var acprve = document.createElement('span');
					acprve.setAttribute('id','acprve')
					acprve.setAttribute('class','glyphicon glyphicon-step-backward')
					var acnext = document.createElement('span');
					acnext.setAttribute('id','acnext')
					acnext.setAttribute('class','glyphicon glyphicon-step-forward')
					acPreNextArea.appendChild(acprve);
					acPreNextArea.appendChild(acnext);
					
					acBtnArea.appendChild(acPreNextArea);
				}
			}
			
			var acfullscreenArea = document.createElement('div');
			acfullscreenArea.setAttribute('class','acfullscreenArea');
			var acfullscreen = document.createElement('span');
			acfullscreen.setAttribute('id','acfullscreen')
			acfullscreen.setAttribute('class','glyphicon glyphicon-fullscreen')
			acfullscreenArea.appendChild(acfullscreen);
			acBtnArea.appendChild(acfullscreenArea);
			
			ctrlBox.appendChild(acBtnArea);
			maxBox.appendChild(ctrlBox);
			
			document.getElementById(boxID).appendChild(maxBox);
		},
		init:function(boxID,options){
			if(options != 'undefined' && options instanceof Object){
				this._createMusicCANVASDom(boxID,options);
			}else{
				this._createMusicCANVASDom(boxID);
			}
			this.acRangeLeft = this._getElementRealLeft(document.querySelector('.acRangeArea'));
			this.acRangeWidth = document.querySelector('.acRangeArea').offsetWidth;
			this.acplayed = document.querySelector('.acplayed');
			this.acPlayBtn = document.querySelector('#acplay');
			this.acVolBar = document.querySelector('.acVolBar');
			
			return this;
		},
		_launchIntoFullscreen:function(){
			var audioCanvasEL= document.querySelector('.audioCanvas');
			if(audioCanvasEL.requestFullscreen) {
				audioCanvasEL.requestFullscreen();
			} else if(audioCanvasEL.mozRequestFullScreen) {
				audioCanvasEL.mozRequestFullScreen();
			} else if(audioCanvasEL.webkitRequestFullscreen) {
				audioCanvasEL.webkitRequestFullscreen();
			} else if(audioCanvasEL.msRequestFullscreen) {
				audioCanvasEL.msRequestFullscreen();
			}
			var canvas = document.querySelector('#MusicCanvas');
			var W = window.screen.width;
			var H = window.screen.height;
			audioCanvasEL.style.width = W + 'px';
			audioCanvasEL.style.height = H + 'px';
			canvas.width = W ;
			canvas.height = H ;
			
			this.acRangeLeft = this._getElementLeft(document.querySelector('.acRangeArea'));
			this.acRangeWidth = document.querySelector('.acRangeArea').offsetWidth;
		},
		_quitFullScreen:function () {
			var audioCanvasEL= document.querySelector('.audioCanvas');
			var canvas = document.querySelector('#MusicCanvas');
			audioCanvasEL.style.width = this.acOriginWidth + 'px';
			audioCanvasEL.style.height = this.acOriginHeight + 'px';
			canvas.width = this.acOriginWidth ;
			canvas.height = this.acOriginHeight ;
			this.acRangeLeft = this._getElementRealLeft(document.querySelector('.acRangeArea'));
			this.acRangeWidth = document.querySelector('.acRangeArea').offsetWidth;
			
		},
		_getFullScreenState:function(){
			return document.fullscreen ||
				document.webkitIsFullScreen ||
				document.mozFullScreen ||
				false;
		},
		_startListenState:function () {
			var that = this;
			that.listenTime = setInterval(function () {
				if(that.oldState !== that._getFullScreenState() ){
					if(that.lockFlag){
						that.fullScreenEvent.fullchange();
						that.oldState=that._getFullScreenState();
						that.lockFlag = false;
					}
				}else{
					that.lockFlag = true;
				}
			},0)
			
			that.fullScreenEvent.addStateListener=function (event,callback) {
				that.fullScreenEvent[event] = callback;
			}
		},
		_addEventListener:function(){
			var that = this;
			that._startListenState();
			
			document.querySelector('#acfullscreen').onclick=function () {
				that._launchIntoFullscreen();
			};
			that.fullScreenEvent.addStateListener('fullchange',function () {
				if(that._getFullScreenState() === false){
					that._quitFullScreen();
				}
			});
			
			document.querySelector('.acRangeArea').onmousedown=function (e) {
				that.clickDown = true;
				that.onlyClick = true;
				that.timeMovePercent = (e.clientX-that.acRangeLeft)/that.acRangeWidth;
				
				that.clickTimePos = parseInt(e.clientX-that.acRangeLeft);
				
				that._setTimeBarPoint(that.timeMovePercent);
				audioapi.seekToTime(that.timeMovePercent);
				that.acIsPlay = true;
				that._updateBtn();
			};
			document.querySelector('.audioCanvas').onmouseup=function(){
				if(that.clickDown){
					that.clickDown = false;
					if(!that.onlyClick){
						audioapi.seekToTime(that.timeMovePercent);
					}
				}
			};
			document.querySelector('.audioCanvas').onmousemove=function (e) {
				// 2s later, hidden the ctrl Area without action
				clearTimeout(that.timeOut);
				var actrl = document.querySelector('.audioCanvas_ctrl');
				that.timeOut = setTimeout(function () {
					actrl.style.opacity=0;
					actrl.style.bottom=-45+'px';
				},2000)
				actrl.style.opacity=1;
				actrl.style.bottom=0;
				
				if(that.clickTimePos !== parseInt(e.clientX-that.acRangeLeft)){
					that.onlyClick = false;
					var sxx = (e.clientX-that.acRangeLeft)/that.acRangeWidth;
					if(sxx < 1 ){
						if(sxx <=0){
							that.timeMovePercent = 0;
						}else{
							that.timeMovePercent = sxx;
						}
					}else{
						that.timeMovePercent = 1
					}
				}
				if(that.clickDown){
					that._setTimeBarPoint(that.timeMovePercent);
					that.setTimeNumberPlaying(that.timeMovePercent*audioapi.duration());
				}
			};
			
			document.querySelector('.acVolBarBox').onclick=function (e) {
				e.stopPropagation();
				var volPercent = (e.clientX-that._getElementRealLeft(this))/this.offsetWidth;
				that.acVolValue = volPercent;
				that._setVolPoint(volPercent);
			};
			document.querySelector('#acVolbtn').onclick=function (){
				if(that.acQuiet === false){
					that._setVolPoint(0);
					this.removeAttribute('class');
					this.setAttribute('class','glyphicon glyphicon-volume-off');
					that.acQuiet =true;
				}else{
					that._setVolPoint(that.acVolValue);
					this.removeAttribute('class');
					this.setAttribute('class','glyphicon glyphicon-volume-up');
					that.acQuiet =false;
				}
			};
			
			that.acPlayBtn.onclick=function () {
				that._updateBtn();
				audioapi.pause();
			};
			if(document.querySelector("#acprve")){
				document.querySelector("#acprve").onclick=function () {
					audioapi._playPrve();
					that.acIsPlay =true;
					that._updateBtn();
				};
			}
			if(document.querySelector("#acnext")){
				document.querySelector("#acnext").onclick=function () {
					audioapi._playNext();
					that.acIsPlay =true;
					that._updateBtn();
				};
			}
		},
		_updateBtn:function () {
			var that = this;
			if(that.acIsPlay){
				that.acPlayBtn.removeAttribute('class');
				that.acPlayBtn.setAttribute('class','glyphicon glyphicon-pause');
				that.acIsPlay =false;
			}else{
				that.acPlayBtn.removeAttribute('class');
				that.acPlayBtn.setAttribute('class','glyphicon glyphicon-play');
				that.acIsPlay =true;
			}
		},
		updateBtnOnLoad:function () {
			var that = this;
			that.acPlayBtn.removeAttribute('class');
			that.acPlayBtn.setAttribute('class','glyphicon glyphicon-pause');
			that.acIsPlay =false;
		},
		_setTimeBarPoint:function (xPosition) {
			var percent = xPosition*100;
			this.acplayed.style.width = percent+'%';
		},
		_setVolPoint:function (volPercent) {
			audioapi.setVolume(volPercent*100);
			this.acVolBar.style.width = volPercent*100+'%';
		},
		timeBarfollowMusic:function (position,num) {
			var that =this;
			if( !that.clickDown ){
				that._setTimeBarPoint(position);
				that.setTimeNumberPlaying(num);
			}
		},
		_setFullTimeNumber:function () {
			var fulltime = audioapi.duration();
			if(fulltime>0){
				var min = String(parseInt(fulltime/60));
				var sec = String(parseInt(fulltime%60));
				var minStr,secStr;
				min.length<2?minStr = '0'+min : minStr=min;
				sec.length<2?secStr = '0'+sec : secStr=sec;
				document.querySelector(".acFullTime").innerHTML=minStr+':'+secStr;
			}
		},
		setTimeNumberPlaying:function (timeSeconds) {
			if(timeSeconds>0){
				var min = String(parseInt(timeSeconds/60));
				var sec = String(parseInt(timeSeconds%60));
				var minStr,secStr;
				min.length<2?minStr = '0'+min : minStr=min;
				sec.length<2?secStr = '0'+sec : secStr=sec;
				document.querySelector(".acPlayedTime").innerHTML=minStr+':'+secStr;
			}else{
				document.querySelector(".acPlayedTime").innerHTML='00:00';
			}
		}
	};
	return new AudioCanvas();
}

var initMusicCanvas=function() {
	this.tools={
		audioApi:null,
		ac:null,
		drawing:null,
		ctx:null,
		canvas:null
	};
}
initMusicCanvas.prototype={
	init:function (boxID,options) {
		var that = this;
		this.tools.audioApi=new Visualizer();
		this.tools.ac=initCanvasDom(this.tools.audioApi);
		this.tools.ac.init(boxID,options);
		this.tools.drawing ={
			onDrawing:function () {}
		};
		
		this.tools.canvas=document.getElementById('MusicCanvas');
		this.tools.audioApi.addEventListener('loading',function () {
			// reset the canvas size to clean the image
			that.tools.canvas.width=that.tools.ac.acOriginWidth;
			that.tools.canvas.height=that.tools.ac.acOriginHeight;
		});
		this.tools.ctx = this.tools.canvas.getContext('2d');
		
		return this;
	},
	bySelectFile:function (fileElementId,filebox) {
		var audioapi = this.tools.audioApi;
		var drawing = this.tools.drawing;
		var ac = this.tools.ac;
		document.getElementById(fileElementId).onchange=function () {
			var file = this.files[0];
			if(filebox){
				filebox.data = this.files[0];
			}
			var reader = new FileReader();
			reader.onload=function (e){
				audioapi.stop();
				var buffer = e.target.result;
				audioapi.init(buffer,function () {
					// todo loaded buffer over
				});
				
				ac.updateBtnOnLoad();
				audioapi.addEventListener('playing',function (){
					ac._addEventListener();
					ac._setFullTimeNumber();
				});
				
				audioapi.addEventListener('ended',function () {
					ac._updateBtn();
				});
				audioapi.addEventListener('drawing',function (nowtime,array) {
					var timePercent = nowtime/audioapi.duration();
					ac.timeBarfollowMusic(timePercent,nowtime);
					drawing.onDrawing(array);
				});
			};
			if(file){
				reader.readAsArrayBuffer(file);
			}
		};
		drawing.addEventListener=function(event, callback) {
			this[event] = callback;
		};
		
		return this.tools;
	},
	byArrayBuffer:function (bufArray) {
		var audioapi = this.tools.audioApi;
		var drawing = this.tools.drawing;
		var ac = this.tools.ac;
		
		audioapi.stop();
		audioapi.init(bufArray,function () {
			// console.log('decode successful');
		});
		
		ac.updateBtnOnLoad();
		audioapi.addEventListener('playing',function (){
			ac._addEventListener();
			ac._setFullTimeNumber();
		});
		
		audioapi.addEventListener('ended',function () {
			ac._updateBtn();
		});
		audioapi.addEventListener('drawing',function (nowtime,array) {
			var timePercent = nowtime/audioapi.duration();
			ac.timeBarfollowMusic(timePercent,nowtime);
			drawing.onDrawing(array);
		});
		
		drawing.addEventListener=function(event, callback) {
			this[event] = callback;
		};
		
		return this.tools;
	},
};


