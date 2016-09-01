function Snake () {
	var canvas = $('#canvas')[0],
		ctx = canvas.getContext('2d'),
		w = canvas.width,
		h = canvas.height,
		cellWidth = 10,
		direction;

	var	self = this,
		food,
		score,
		snakeBody,
		gameLoopInterval,
		status = '';

	var originSnakeLength = 5;
	
	this.init = function () {
		direction = 'right';
		createSnake();
		createFood();
		score = 0;
		status = 'play';
		
		//Move the snake using a timer which will trigger the paint function every 60ms
		if(typeof gameLoopInterval != 'undefined') clearInterval(gameLoopInterval);
		gameLoopInterval = setInterval(paint, 60);
	}

	this.play = function () {
		gameLoopInterval = setInterval(paint, 60);
		status = 'play';
	}

	this.stop = function () {
		clearInterval(gameLoopInterval);
		status = 'stop';
	}
	
	function createSnake () {
		snakeBody = []; //Empty array to start with
		for(var i = originSnakeLength-1; i>=0; i--) {
			snakeBody.push({x: i, y:0});
		}
	}
	
	function createFood () {
		food = {
			x: Math.round(Math.random()*(w-cellWidth)/cellWidth), 
			y: Math.round(Math.random()*(h-cellWidth)/cellWidth), 
		};
	}
	
	function paint () {
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = 'black';
		ctx.strokeRect(0, 0, w, h);
		
		//Pop out the tail cell and place it infront of the head cell
		var nx = snakeBody[0].x,
			ny = snakeBody[0].y,
			tail;

		if(direction == 'right') nx++;
		else if(direction == 'left') nx--;
		else if(direction == 'up') ny--;
		else if(direction == 'down') ny++;
		
		//This will restart the game if the snake hits the wall.
		//If the head of the snake bumps into its body, the game will restart.
		if(nx == -1 || nx == w/cellWidth || ny == -1 || ny == h/cellWidth || checkSelfCollision(nx, ny, snakeBody)) {
			self.init();
			self.stop();
			return;
		}
		
		//If the new head position matches with that of the food, create a new head instead of moving the tail.
		if(nx == food.x && ny == food.y) {
			tail = {x: nx, y: ny};
			score++;
			createFood();
		} else {
			tail = snakeBody.pop(); //pops out the last cell
			tail.x = nx; tail.y = ny;
		}
		
		snakeBody.unshift(tail); //puts back the tail as the first cell
		
		for(var i = 0; i < snakeBody.length; i++) {
			var c = snakeBody[i];
			paintCell(c.x, c.y);
		}
		
		paintCell(food.x, food.y);
		ctx.fillText('Score: ' + score, 5, h-5);
	}
	
	function paintCell (x, y) {
		ctx.fillStyle = 'red';
		ctx.fillRect(x*cellWidth, y*cellWidth, cellWidth, cellWidth);
		ctx.strokeStyle = 'white';
		ctx.strokeRect(x*cellWidth, y*cellWidth, cellWidth, cellWidth);
	}
	
	function checkSelfCollision (x, y, array) {
		//This function will check if the provided x/y coordinates exist in an array of cells or not.
		for(var i = 0; i < array.length; i++) {
			if(array[i].x == x && array[i].y == y) return true;
		}
		return false;
	}
	
	$(document).keydown(function(e){
		var key = e.which;
		if(sessionStorage.getItem('currentTab') == '#Snake') {
			// if(key == '74' && direction != 'right') direction = 'left';
			// else if(key == '73' && direction != 'down') direction = 'up';
			// else if(key == '76' && direction != 'left') direction = 'right';
			// else if(key == '75' && direction != 'up') direction = 'down';
			// else if(key == '27' && status != '') (status == 'play')? self.stop():self.play();
			if(key == '37' && direction != 'right') direction = 'left';
			else if(key == '38' && direction != 'down') direction = 'up';
			else if(key == '39' && direction != 'left') direction = 'right';
			else if(key == '40' && direction != 'up') direction = 'down';
			else if(key == '27' && status != '') (status == 'play')? self.stop():self.play();
		}
	});
}