all: web node

clean: 
	rm -rf ./lib


web:
	mesh make web 

node:
	mesh make node 

