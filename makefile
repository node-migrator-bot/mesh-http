all: web node

clean: 
	rm -rf ./lib


web:
	mesh merge web 

node:
	mesh merge node 

