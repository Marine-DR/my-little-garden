# Happy Flow

## Catalog of plants management

### Replace the current plants catalog

Click on button to replace > upload the .csv file with the new catalog > Confirm the action > The catalog of plants contains only the plants from the .csv

### Add new plants in the catalog

- Several at the time:  
  Click on button to add plants by batch > upload the .csv file with the new plants > The plants from the .csv file are added to the catalog
- One by one:
  Click on button to add only 1 plant > complete the plant information > save the new plant > plant is added to the catalog

### Modify plants in the catalog

Click on button to modify plants by batch > upload a CSV file with all the information about plants to modify > preview modified, missing, unchanged, warning, and error rows > if plants are missing, choose to create missing plant or ignore them > confirm the complete batch > modify existing plants and apply the conflict choice in one transaction > display modified, created, ignored, and unchanged counts

Blank optional cells clear existing optional values. Current photos are preserved.

### Export the current plants catalog

Click on button to download the catalog > download a complete CSV
containing all plants and related informations > edit the file for a later modification or replacement

### Delete plants from the catalog

Check one or more plants in the catalog > click on the delete button > display the plant names and every affected selection > confirm the action > display deleted plant and affected selection counts

## Flowers selection management

### Create a new selection

Select plants in the catalog > click on button to create a new selection > name the selection > a new selection is created and contains the selected flowers.

### Modify a selection

- Add plants:  
  Select plants in the catalog > click on button to add in an existing selection > select one or more selections to update > confirm the action > selection updated. If a selected flower is already present in a target selection, the existing association is ignored and no error is generated.
- Remove plants:  
  Select plants in the selection > click on the removing button > confirm the action > plants removed from the selection

### Delete a selection

Select the selection > click on deletion button > confirm the action > the selection is deleted

## Flowerbed design

- Create a new flowerbed design:  
  Click on button to create a new flowerbed > select the form of the flowerbed > enter the dimension of the flowerbed > select the plants selection to use > create the available space for planting > position plants in the available space > Save the design
- Modify a flowerbed:  
  Select an existing flowerbed > Select plants to move/remove/add plants > Save the design
- Generate buying list and planting plan:  
  Select an existing flowerbed > click on the button to generate the buying list and the planting plan > List and plan generated
- Download to buying list and planting plan:  
  Select an existing flowerbed > click on the button to download the list and the plan > List and plan downloaded
- Delete a flowerbed design:  
  Select and existing flowerbed > click on the deletion button > confirm the action > the flowerbed is deleted

# Back up Flow

## Catalog of plants management

### Issue during plant catalog replacement

Click on button to replace plant catalog > upload the new catalog > display all blocking errors > acknowledge the issue > cancel the replacement > catalog and selection warnings remain as before the replacement

### Issue when add a pool of plant via CSV

Upload a CSV > message with all errors > acknowledge the issue > catalog and selections remain unchanged

### Issue when modify a pool of plant via CSV

Upload a CSV > message with all errors > acknowledge the issue > catalog and selections remain unchanged

### Cancel a plant deletion

Check plants in the catalog > click on the delete button > review affected plants and selections > cancel the action > no change in the plant catalog, selection links or pending warnings

### Changes on plants used in a selection

- Modify plants used in a selection:
  Modify one or several plants > display the list of affected selections > confirm the action > plants modified in catalog and selections
- Modify the same plant several times before review:
  Keep the first old state and compare it with the latest catalog state > count the plant once > remove the warning automatically if the plant returns exactly to the retained baseline
- Delete plants used in a selection:  
  Select one or several plants > click on delete button > display affected selections in the confirmation > confirm the deletion > remove plants from the catalog and selections > display deleted-plants status in every affected selections
- Review modified plants in a selection:
  Open the selection detail > review all modified plants > acknowledge or close the modified-plants panel > clear the displayed modification warnings > Update the selection status
- Review deleted plants in a selection:
  Open the selection detail > review all deleted plants > acknowledge or close the deleted-plants warning > Update the selection status


### 2 photos for the same plant

Upload a photo > a photo already exist for this plant > display a message to select the photo to keep > update the photo related to the plant

## Flowers selection management

### Cancel a selection deletion

Select the selection > click on deletion button > cancel the action > the selection is not deleted

### Delete a selection used in a design

- Buying list and planting plan generated:  
  Select the selection > click on the deletion button > display the list of design impacted > confirm the action > the selection is deleted and the design remains but cannot be edited anymore
- Buying list and planting plan not generated:  
  Select the selection > click on the deletion button > display the list of design impacted > confirm the action > the selection and the design are deleted

### Cancel the removing of a plant in a selection

Select plants in the selection > click on the removing button > cancel the action > plants remain in the selection

### Remove plants used in a design

Select the plants > click on the removing button > list the impacted designs > confirm the action > the plants are removed from the selection and from the designs

## Flowerbed design

### Cancel a design deletion

Select and existing flowerbed > click on the deletion button > cancel the action > the flowerbed design is not deleted

### Plants areas overlap

Place the plants > the plants areas are displaied in red and a warning is display when there are overlap > save the design > click to generate the buying list and the planting plan > display a message to indicate there are plants areas overlaping > confirm the generation > generate the document with a warning message on the planting plan

### Plants exceed the available space

Place the plants > the plants areas are displaied in orange and a warning is display when plants exceed the available space > save the design > click to generate the buying list and the planting plan > display a message to indicate there are plants areas that exceed the available space > confirm the generation > generate the document with a warning message on the planting plan

### Update the flowerbed dimension

Select change the flowerbed dimension > update the dimension > save the new dimension > update the flowerbed view dimension, plants remain at the same place and display in red the plants that are exceeded the available space
