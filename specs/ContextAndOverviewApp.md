# Context
MyLittleGarden is an application for Amateur gardener. It allows to create flowerbeds. 
It will be possible by selecting flower in a list and design the flowerbed based on the selection.

For now, this application will run on a computer with Windows or Linux. 
The application should be responsive to be well displayed on different screen size.
Later, it can run on a server to allow to have some features available on a mobile phone via an application.

The Database can contain several thousands of flowers.  
Each flower will have several attributes to allow to identify the most adapted plants for the current flowerbed projet. 
Each flower will have one picture associated to ease the flower identification.

# How it works
MyLittleGarden contain a list of plants, mainly flowers, with some related attributes. Each plant is associated to a photo to allow to identify it easily.   
The user will be able to choose the flowers he likes in this list according to the constrains he has (soil type, amount of sunlight, time spent in the garden, etc). Then, he can save his selection to use it for a design.   
*Note: Several selections can be done, all based on the same initial list.*  
Once the flowers were selected, he will be abble to design the flowerbad using a visual HMI that allow him to place the plants taking into account the constrains like space available and space around each plant.  
When the design is done, a planting plan and a flower list are generated. The flower list allow to buy the flowers you need. The planting plan allow to make your design real.

# MVP
* Visualize a list of plants with the related attributes and photo.
* Update the list of plants by .csv. Uploading a .csv file will delete and replace the existing list.
* Filter the list base on different attributes (for MVP, only soil type, sunlit exhibition and flowering period).
* Create a list of plants and save it.

# Main features 
* List of plant: this list contain plants and some related attributes, including photo. That allow to select the most relevant plants for the project. The user can update this list by adding, modifying or deleting elements. He can do it by batch (via .csv) or on by one. The user will be able to hide/show the different column and to deplace it.  
* Flower selection: the user can select the plants he likes most and that have the same needs. He can save this list to reuse it later to design his flowerbed. To find easily the plants, he can filter, sort and search in the list. He can select plants by ticking the box then adding it in the list. The list can be new or an existing one. To easily identify the list, you have to name it. The list can be modified and deleted one by one. A flower can be in several list.
* Generate a list of flowers to buy: The list of flower include the name of each flower, the color and the number of element needed for each plants. 

# Other features
* Design the flowerbed: to design it, you will have to define the space available by drawing it and provide the dimensions. Once it is done, the user can select the plant from the list and place it. The tool will indicate the space needed around each plants.
* Generate the planting plan: The planting plan allow to plant flowers at the right place to make the idea real.
* Maps view to lay out the flowerbed: add information from Maps with the scale. The user will be able to indicate on the view where he wants to place the flowerbeds. Ideally, it will allow to have the amount of sunlight. That will allow to propose flowers that suit with the sunlight condition.
* Flowerbed visualization: allow to have a review of the flowerbed in 3D. The preview is not detailled, it will be color spots of the corresponding size and at the right heigh. The idea is to be able to visualise the final result at the height of the flowering season.