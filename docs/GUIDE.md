# User's Guide for the Battle of Kursk, Southern Front: A Validation Data Base

31 July 1996. Contract DASW01-95-C-0068.

Prepared for the U.S. Army Concepts Analysis Agency, 8120 Woodmont Avenue, Bethesda, Md. 20814-2797, by The Dupuy Institute, 1497 Chain Bridge Road, Suite 100, McLean, Va. 22101.

> Converted from `GUIDE.DOC` (Word 6.0). The original's table of contents is dropped because its page numbers don't apply. Attachments 1 to 4 (menu screens, blank records, sample reports, database structure) are listed in the original but their content is not in this file.

## I. Introduction

The Kursk Simulation Data Base is a detailed data base of the Southern Front of the Battle of Kursk from the 4th through the 18th of July 1943. It tracks the location, status and activity of all division-size and larger units for every day of the battle. The data base's immediate use is to validate models and simulations representing modern armored and combined arms combat operations. Only part of the Battle of Kursk is included in this data base. The area and time period chosen represents an offensive by a heavy armor force consisting of two German armies (4th Panzer Army and Provisional Army Kempf). They were attacking into a heavily fortified Soviet defensive position consisting of 7 armies, counting reinforcements, in which the Soviet defensive force included strong armored elements.

The data base is geared specifically to support the Concepts Evaluation Model (CEM) used by the U. S. Army Concepts Analysis Agency (CAA). Beyond its immediate planned use, the data base has potential value for analyzing combat, including casualty rate studies, advance rate studies and other items of interest to operations research analysts.

The data base is assembled in a computerized data base format for ease of use for quantitative analysis. To parallel the Ardennes Campaign Simulation Data Base (ACSDB), the data base has been set up using dBase IV in a structure that is compatible with ACSDB.

All data used was researched from primary sources, where such data was available. Where primary source data was not available, critical data was interpolated by reviewing existing data. Use of secondary sources was limited in this project to some weapons data. Data was researched from the captured German records in the US National Archives, the German Military Archives at Freiburg, Germany, and the Russian Military Archives at Podolsk, Russia. This project is unique in that it is the first time extensive access has been obtained to the primary source data from the Russian Military Archives.

This User's Guide has been prepared for the Kursk Data Base. It can also be used for the Ardennes Campaign Simulation Data Base. It is only intended to show the user how to access the data base, and what reports are available from the data base. Detailed explanations of the definition and content of each field, and any conventions used, are contained in a separate document called the Kursk Data Base Conventions.

## II. Data Base Design

The Ardennes Campaign Simulation Data Base (ACSDB) design was used as the basis for the Kursk Simulation Data Base design. The Ardennes data base is a relational data base programmed in dBase IV, a commercially available data base package. The Kursk Data Base is compatible with the Ardennes Data Base in that they use essentially the same data base structure. The Kursk Data Base has added a few additional fields and does not use a number of the fields used for Ardennes. The report programs are similar. The data is recorded in the same way, except for a few definition changes and changes in the abbreviations. The Kursk data base has also been modified to take advantage of the use of "memo fields" allowed by current editions of dBase.

A supporting document is the Kursk Data Base Conventions. It includes the definitions of the fields in the data base, records the approved abbreviations, defines the weapons, tells how the data is to be coded, and provides other data entry rules. This User's Guide explains how to access the data and reports.

The original Ardennes Campaign contract spelled out the specifics of what should be included in the data base by item. This data base, with some changes, was structured to fulfil those same requirements. The requirements were established to support two computer models, the Force Concept Evaluation Model (FORCEM) and the Joint Theater-Level Simulation (JTLS). The actual validation effort was conducted by CAA on the Concepts Evaluation Model (CEM).

For definition purposes, there are two data bases, the Ardennes Campaign Simulation Data Base (ACSDB) and the Kursk Data Base (KDB). Each data base consists of eight files. There are three files that track a unit's current status for each day of the campaign, two files that track support data for those units, one air data file and two files that track source data for the other six files. The **Air Data** file contains information on air sorties and air operations. The **Unit Data** file contains personnel strength data, casualty data, data on logistics, medical facilities, and attachments and detachments. The **Inventory Data** file contains strength data on weapons and major items of equipment for ground units. The **Unit Location** file contains geographical and temporal information and data for ground units. The **TO&E Data** file contains information and data on authorized organizational equipment and personnel strengths of ground units. The **Weapons Data** file contains information and data on characteristics and performance of air and ground weapons and equipment. The **Reference Data** file contains information on sources used to compile data for the ACSDB. This data is keyed to Air, Unit, Unit Inventory, Unit Location, TO&E, and Weapons Data Base records. The **Bibliography Data** file contains complete bibliographic information on primary and secondary sources used in Reference Data Base records.

Each file consists of a number of records. For the Unit Location, Unit Data and Unit Inventory files, there is one record for each unit for each day. The TO&E Data has a record for every unit, the Air Data has a record for every sortie or group of sorties, the Weapons Data has a record for every weapon, the Reference Data was a file for every "source", and the Bibliography Data has a record for every source referenced for the data base. The unit status type files, although all tracking the same units, were broken into three separate files for ease of handling and data manipulation. Each file consist of a number of records where data will be inputted into them as required. The files, with the number of fields in each record, are listed below.

  | Group        | File                | Fields |
  | ------------ | ------------------- | ------ |
  | Unit status  | Unit Location Data  | 58     |
  | Unit status  | Unit Data           | 109    |
  | Unit status  | Unit Inventory Data | 134    |
  | Support data | TO&E Data           | 117    |
  | Support data | Weapons Data        | 52     |
  | Other        | Air Data            | 12     |
  | Source       | Reference Data      | 82     |
  | Source       | Bibliography        | 4      |

Attachment 4 contains a list of all the fields used in the data base. Not all of these fields are referenced in the menus (the source of the count above). The following fields are in the data base but do not appear in the input, edit or view screens of the data base:

  | File     | Field      |
  | -------- | ---------- |
  | UNITLOC  | UNIT_SIZE  |
  | UNITDATA | UNIT_SIZE  |
  | UNITDATA | PARENTUNIT |
  | INVENTOR | UNIT_SIZE  |
  | TOE      | UNIT_SIZE  |
  | TOE      | SUPPLY_TNS |
  | WPNS     | LTHLAREA2  |
  | WPNS     | LTHLAREA2A |

The four "UNIT_SIZE" fields are used for sorting the data base. The other four fields are left over from previous revisions and are not used.

This User's Guide includes the changes made during all three phases of this project. These include:

1\. Reorganization and addition of reference points for the Unit Location file.

2\. Adding a field to the Unit Inventory, Unit Location, Unit Data, and TO&E to identify unit size.

3\. Some minor corrections to the data base and reporting programs.

There are changes that were identified in the Phase I final report but were never made. They include:

1\. Modification of screen displays so as not to show fields not in use for the Kursk Data Base.

2\. Exploring options to create a graphic interface for the Kursk Data Base to allow a user to actually review the Unit Locations file's front line traces on a map.

## III. Setting up the database

### A. Equipment requirements

The data base requires at least an IBM-compatible computer with any IBM processor (8086, 286, 386, 486 or Pentium). Due to the size of the data base, it is recommended that a computer with at least a 286 processor is used.

The user will also need to obtain a copy of dBase IV from Borland. The data base was originally written in dBase III, but has been modified to take advantage of the "memo" fields that exist in dBase IV. dBase IV is supported by MS-DOS 4.01 or greater.

A hard disk is required to use and manipulate the data base. The original Ardennes data base, as delivered from the Defense Technical Information Center (DTIC) consist of a report disk and 33 disks of data. In an uncompressed form, it occupies a little over 60 megabytes on the disk. The Kursk data base currently requires 6 megabytes of disk space and will certainly require much more when it is complete. No other special equipment requirements are necessary for these data bases.

### B. Recommended support programs

TDI has traditionally used a number of publicly available programs to compress or correct problems with the data base. It is recommended that the user obtain copies of these programs if they are going to do extensive work with the data bases.

#### PKZIP and PKUNZIP

Due to the size of the data base, and the fact that blank fields in the dBase take up the same amount of space as full fields, these data bases can occupy considerable disk space, often over 60 megabytes. TDI uses PKZIP (version 2.04G) to compress these data bases down to less than 10 megabytes. PKZIP is "shareware" meaning it is publicly available, uncopyrighted software. Any compression program can be used to store the data base, or the data base can be saved uncompressed.

#### DBFCLEANS, DBTCHECK, MDXFIX

This set is a group of "shareware" programs designed primarily to sort out memo fields but can also be used to correct dBase code that has been garbled. The garbling of code can occur and when operating dBase during a power failure. While it is recommended that the user turn off the machines during thunder storms, this program has been able to correct code that has been garbled as a result of power failures while operating the dBase program.

### C. Saving the data base

#### Backing up using PKZIP

To back up the data base in a compressed form using PKZIP, PKZIP needs to be installed in a directory on the hard drive of the computer. That directory must be included in the "PATH=" statement in the AUTOEXEC.BAT file. Starting from the root directory of the computer, the procedure is:

1\. Put a blank formatted 3.5" high-density disk into drive (usually drive "a")

2\. type "cd dbase"

3\. type "cd kursk"

4\. type "pkzip kursk.zip \*.dbf \*.dbt \*.prg

5\. type "Zip2Exe Kursk.zip"

6\. type "copy kursk.exe a:

7\. type "cd.."

8\. type "copy mainmenu.prg a:"

You will need hit the "return" or "enter" key after every numbered step.

This will complete the backup. The user should have two files listed on the disk in drive "a" called "KURSK.EXE" and "MAINMENU.PRG". They should have the current date. If the user wishes to save to a drive other than "a", then the "a" in steps 6 and 8 above needs to be changed to the drive name used. The user should hit the return key after typing each line.

### D. Loading the data base

To load or restore a database that has been compressed using PKZIP and stored on a 3.5" disk, as described in the procedure above. Use the following procedure:

1\. Insert the 3.5" disk with backup files (KURSK.EXE and MAINMENU.PRG) into drive (usually drive a).

2\. Type "cd c:\dbase"

3\. Type "copy a:mainmenu.prg." A space goes between the "prg and the ".".

4\. Type "cd kursk"

5\. Type "copy a:kursk.exe ." A space goes between the "zip" and the "."

6\. Type "kursk"

7\. Answer "yes" to any prompt to overwrite previous versions of the files.

You will need hit the "return" or "enter" key after every numbered step.

If the user wishes to load from a drive other than "a", then the "a" in steps 3 and 5 above needs to be changed to the drive name used. The user should hit the return key after typing each line.

## IV. Log-On and Log-Off Procedures

### A. Log-on

The data base is entered (log-on) from the root directory in the DOS system. The procedure is to first switch on the computer and the monitor. When the characters "c:\\\>" appear on the screen, type "cd dbase." At this point the characters "c:\dbase" will appear. Type "dbase." The dBase logo will appear briefly, before being replaced by the licensing agreement. After a few seconds this page will disappear, to be followed by a nearly blank screen. Should you wish to speed up the previous step, hit the "ENTER" key when the licensing agreement appears on the screen.

On the nearly blank screen the cursor will come to rest directly above the word "command." Type the words "do mainmenu," always being sure to leave a space between the words "do" and "mainmenu," but joining the words "main" and "menu" together.

The previous step will present you with the Historical Database Main Menu. The user will then be presented with two choices--"1\> Ardennes Database," and "2\> Kursk Database." Select number 2.

The log-on procedure is listed briefly below:

1\. Switch on computer and viewing screen;

2\. Type "cd dbase";

3\. Type "dbase";

4\. Type "do mainmenu";

5\. Select "2";

6\. Hit "ENTER" key.

### B. The main menu

The preceding command will access the Kursk Data Base Main Menu. See attachment 1 for a copy of the main menu screen. From here one can access any reports and records contained in the data base by hitting the appropriate number. These reports and records available are explained below and included samples are provided in attachments 2 and 3.

### C. Log-off

When you wish to exit the data base (log-off), go to the end of the record you are working on and hit the "PAGE DOWN" key if in "enter" mode or "edit" mode. If in "view" mode, then hit "enter" (also referred to as "return") to get to the end of the record. This will bring up a nearly blank screen with the message "Enter 'f' if finished, or enter the number of the next record to edit, or \<RETURN\> to go to next record." Hit "f" and then the "ENTER" key. If the user is in the "enter" or "edit" modes this will return to the "Kursk Data Base Main Menu". If this is done in the "view" mode, it will return to the "Historical Data Base Main Menu". At the bottom of the "Kursk Data Base Main Menu" it reads "Pick a number or type 0 to QUIT:", hit "0" and then the "ENTER" key. This will bring the user to the "Historical Data Base Main Menu". The user can exit the main menu by typing "0" and then the "ENTER" key.

When a period (.) appears at the bottom of the left-hand corner of the screen, type "QUIT" and hit the "ENTER" key. The characters "C:\DBASE" will appear. Typing "cd \\" will return the user to the root directory of the DOS system.

The log-off procedure is listed briefly below:

1\. Go to the end of record;

2\. Hit "PAGE DOWN" key;

3\. Enter "f";

4\. Hit "ENTER" key;

5\. Hit "0";

6\. Hit "ENTER" key;

7\. Hit "0";

8\. Hit "ENTER";

9\. Type "QUIT";

10\. Hit "ENTER".

11\. Type "cd \\"

When using a version of the data base set up only for viewing Ardennes data (no Kursk Data Base attached), then when one exits the Ardennes Data Base Main Menu, one is immediately exited from dBase and to the DOS prompt (step 11).

## V. The Menus

When you have reached the Kursk Database Main Menu (see chapter IV, section B), you will be free to choose from among any of the eight data base files already described above (see chapter II), plus the REPORT MENU. Access to each file can be gained in one of three modes, data entry, data edit and data view. Some versions of the Ardennes and Kursk data bases do not have enter or edit options, they are simply set up to "view" the data to prevent any accidental changes to the data base.

### A. Enter

The ENTER mode allows the user to add new records and enter data into the data base. The user can complete a record in the "enter" mode, add some data, or simply create a blank record by adding no data. These records can then be edited later or have additional data added to them in the EDIT mode.

To access any of the ENTER menus, type numbers 1, 4, 7, 10, 13, 16, 19, or 22. This will allow the user to append one or more blank records to the data base file selected.

The ENTER option of any file allows the user to perform two basic functions. The user may type in new information in the various "fields," which are the numbered entries within the records. The user may also create new records by repeatedly hitting the "PAGE DOWN" key on the keyboard until he reaches the page on the screen which states: "Enter 'f' if finished, or \<RETURN\> to continue:" By hitting "RETURN", the user creates the next blank record, which will then appear on screen. Since sometime all the data for a single record will not fit on a single screen, the user can advance screens within the record by hitting the "PAGE DOWN" key. Once the user has gone past a screen within a record in the data entry mode, there is no way to return to it to correct any data that may have been entered in error. This can be corrected later in the "edit" mode. Most users find it more convenient to create records using the ENTER mode but to actually add the data to the records using the EDIT mode.

It is expected that only the organization creating the data base will have a need to use the enter screens.

### B. Edit

The EDIT mode allows the user to change the data in existing records or add data to existing records. Entirely new records can only be added in the ENTER mode. The EDIT mode contains data which has been previously inputted, either by working directly within the menu, or by work in the ENTER menu. To access any of the EDIT menus, type numbers 2, 5, 8, 11, 14, 17, 20, or 23. Hitting any of these numbers will open a menu reading "Enter a record number to start editing at, or enter \<RETURN\> to start at top of file."

By simply hitting the RETURN key the first record in that file will appear. A particular record can be found by typing the record number and hitting the "RETURN" key to access it. Pages within the record are "turned" by hitting the "PAGE DOWN" key to view subsequent screens.

New information may be added by inserting new text in the following manner. By pushing the "INSERT" button, the "INSERT" command will appear in the upper right hand corner, allowing the user to insert text in the previous text at the point of the cursor. By not choosing the "INSERT" mode, the user will write over the previous text.

The data entered onto the screens is saved every time a record is completed. When in the edit mode, any keystroke made will end up adding data into the file or changing existing data. There is no method to change the data back once it has been entered, except to re-enter the correct data. Therefore, if the user simply wishes to view the data, it is recommended that the view screens be used to prevent accidently changing the data.

Except for viewing memo fields, it is expected that only the organization creating the data base will have a need to use the edit screens.

### C. View

The view screens are provided as a means of reading the data while protecting them from unwanted accidental changes. This is useful for browsing the data base. The original version of the Ardennes data base that was delivered to CAA and is available through DTIC was set up only to be accessed to the view screens.

The VIEW menus may be accessed by selecting numbers 3, 6, 9, 12, 15, 18, 21, or 24 in the Kursk Database Main Menu. The VIEW screens are identical to the EDIT screens, with the following restrictions: 1)the material cannot be edited or changed in any way; 2) the user must use the "RETURN" key to advance the page on the screen, whereas the previous two menu types require the user to type "PAGE DOWN." Also, in the VIEW menus the user cannot read the MEMO fields.

### D. Memo fields

Memo fields are a feature of the dBase IV software. They allow a large amount of text to be entered into a field. This option did not exist in dBase III and there are no memo fields in the original version of the Ardennes data base. The data in the Ardennes data base was simply forced to fit within the restrictions of the 164 character limit for each field. In the Kursk data base, memo fields are used only for a few fields where extensive description is used (like "Remarks" and "Other Significant Events"). Unfortunately, it is not possible to view a memo field when in the VIEW mode, one must be in ENTER or EDIT to access a memo field.

Memo fields may be accessed by pressing the "CONTROL" and "HOME" (Ctrl-Home) keys simultaneously when the cursor is in the memo field to be selected. This command will deliver the user to a blank screen, where he can input an unlimited amount of information. To get out of a Memo field, the user types "F10" or "Ctrl-End". A block with the message "Save this memo field" will then appear. Press the right arrow key until you reach the block which reads "Save changes and exit," and then press the "ENTER" key.

### E. The records

The files constitute the database and contain all the information available about a particular unit's day-to-day manpower strength, weapons strength, location and posture, as well as its authorized strength and the characteristics of its weapons. There are also files for holding all reference and bibliographical data. Each of the eight files can be accessed through the "Kursk Database Main Menu" in either the ENTER, EDIT or VIEW mode. The eight files consist of:

#### Unit Data

This file contains 109 fields which describe the unit in question. The file contains personnel, medical, and logistical statistics, plus records of attachment and detachment of other ground combat units. There should be one record for each unit for each day. A blank record is shown in Attachment 2.

#### Unit Inventory Data

This file contains 134 fields with information on all "modeled" equipment in the unit, equipment losses, and equipment repaired or received as replacements. There should be one record for each unit for each day. A blank record is shown in Attachment 2.

#### Unit Location Data

This file contains 58 fields with information regarding the geographical positions, activities, operations, environmental conditions, obstacles, fortifications, missions and command status of ground combat units. The actual location of the unit is provided by a six-digit grid coordinate system with 100 meter resolution. For the Kursk project, this grid system is from the 1942 1:50,000 Soviet maps in use at the time. For the Ardennes, the Army Mapping System grid was used. There is one record per unit per day. A blank record is shown in Attachment 2.

#### Air Data

This file contains 12 fields, listing all air missions into a defined campaign area. All ground attack, sweeps and reconnaissance missions in the campaign area are included. No missions of a "strategic" nature are included. Interdiction missions against enemy ground units and supplies arriving by rail, once they have been unloaded, are included. Aircraft that are recalled or that turn back due to weather are excluded, even if the mission was completed by other aircraft. All photo reconnaissance, reconnaissance, or other missions without an identifiable locations are excluded.

Aircraft that spend only part of the time in the battle area are recorded and their activity outside of the area is noted in the **Remarks** field. Aircraft that have mechanical problems or failures are included, and are usually described in the **Remarks** field. There is one record per mission (group of sorties) per day. A blank record is shown in Attachment 2.

#### TO&E Data

This field contains 117 fields, listing the authorized equipment, personnel and basic supply loads of each unit. There is one record for every unit in the data base. A blank record is shown in Attachment 2.

#### Weapons Data

This file contains 52 fields and records information on equipment (vehicles and weapons) characteristics. The records are used for all air and ground systems in the Inventory, Air and T/O&E databases, including aircraft, armored fighting vehicles, indirect fire weapons, and softskin transport vehicles. The same equipment designations used in the Unit Inventory, Air and T/O&E databases are used in the weapons database. There is one record for each weapon in the data base. A blank record is shown in Attachment 2.

#### Reference Data

This file contains 82 fields and is used to reference data recorded in the Unit Location, Unit Data, Unit Inventory, T/O&E Data, Air Data and Weapons Data bases. This referencing to the appropriate data base is done by having a field in each data base called **Source** that contains an alpha-numeric code. The reference section allows an analyst to record by field number the source of the data, by page number. The reference section of the data base is not always used due to the amount of time required to create such detailed referencing. There is one record for each source code used in the data base. A blank record is shown in Attachment 2.

#### Bibliography Data

This file contains 4 fields and is used to record full bibliographic information on primary and secondary sources used for data in the various data bases. The entries in the bibliography data base describe sources referenced in both the reference data base and in the various narratives used to describe the derivation of data. There is one record for bibliographical reference. A blank record is shown in Attachment 2.

### F. The reports

By choosing option 25 on the Kursk Database Main Menu, the user will be routed to the Kursk Database Report Menu. A copy of that menu is provided in Attachment 3. It has 10 options, the first eight accessing submenus for each of the eight files. There is also one option for casualty reports and one option for "other" or miscellaneous reports. The ten options are:

1\. UNIT LOCATION Reports

2\. UNIT DATA Reports

3\. WEAPONS DATA Reports

4\. AIR Reports

5\. BIBLIOGRAPHY Reports

6\. TO&E Reports

7\. UNIT INVENTORY Reports

8\. REFERENCE DATA Reports

9\. CASUALTY Reports

10\. OTHER Reports

Each of these options leads to a menu that allows the user to select one or more reports. Select the number of the report that you wish to access. In parentheses next to each report name (or description) on the menu is a six to eight character title that is actually the name of the report in dBase. For example, the first report program in the Casualty Report Menu is "CASSUM". There is a copy of the menu for each of these subdirectories in Attachment 3. It is placed in front of the sample copies of each of the reports in that menu.

These reports are usually lists, in tabular form, highlighting specific data within the files. The reports present condensed, easily readable summations of material stored in the data base. They may also be used to edit the data base by comparing the information contained with that in the various records. Examples of each of the reports are shown in Attachment 3. Some of these examples are taken from Ardennes Data Base data since the Kursk Data Base does not have sufficient data at this time.

Below is provided a brief explanation of the reports available in each menu. Most reports are simply drawn directly from selected fields in the data base. In the case of the "record number" this is a number assigned to that record by the computer, and will change if the data base is sorted or records are deleted.

#### Unit Location Reports

This contains a report that is an alphabetical listing of all units participating, their parent units, and nationalities, as well as their source and record number. The data is taken from fields 1, 3, 4, 58 of the Unit Location file. A sample report is shown in Attachment 3.

#### Unit Data Reports

These consist of two reports: 1) an attachment/detachment list by division (ADLIST), detailing when units were attached or detached to/from a particular division; and 2) an attachment/detachment list by date (ADLIST 2), detailing on what date units were attached or detached. These two reports are taken from fields "Unit Name", "Date" and 60 through 79 in the Unit Data file. These reports are useful for proofing that all the attachments and detachments are properly recorded and tracked. A sample report is shown in Attachment 3.

#### Weapons Data Reports

These consist of two reports: 1) weapons listing sorted by name (WPNLIST); and 2) weapons listing sorted by source (WPNLIST2). These reports are taken from fields 1 and 17. As the data base conventions require that the weapon names used in the Weapons Data, TO&E Data and the Inventory Data all be the same, this report, along with TOENDX and INVNDX, are useful for proofing that this was done across all three data bases. A sample report is shown in Attachment 3.

#### Air Reports

These consist of two reports: 1) the number of sorties by aircraft type by day (SORTICNT); and 2) the number of sorties by nationality by day (SRTICNT2). SORTICNT is created from fields 1, 2 and 3 of the Air Data. It adds up all the sorties flown by that aircraft type on that day. SRTICNT2 is taken from fields 1, 2 and 8. It adds up all the sorties done by that nationality for a given day. A sample report is shown in Attachment 3.

#### Bibliography Reports

There are no bibliography reports at this time.

#### TO&E Reports

These contain an indexed list of equipment names (TOENDX). This report is taken from fields 3 through 26 of the TO&E Data. As the data base conventions require that the weapon names used in the Weapons Data, TO&E Data and the Inventory Data all be the same, this report, along with WPNLIST and INVNDX, is useful for affirming the adherence to these conventions in all three data bases. A sample report is shown in Attachment 3.

#### Unit Inventory Reports

These contain an indexed list of equipment names (INVNDX). This report is taken from fields 1 through 16 of the Unit Inventory Data. As the data base conventions require that the weapon names used in the Weapons Data, TO&E Data and the Inventory Data all be the same, this report, along with WPNLIST and TOENDX, is useful for affirming the adherence to these conventions in all three data bases. A sample report is shown in Attachment 3.

#### Reference Data Reports

These contain an alphabetic listing of sources in REFERENC.DBF (REFLIST2). This report is taken from field "Source Number" in the Reference Data. As the data base conventions require that the source numbers used in all other files match the source number of this file, this report, along with UNITLIST and WPNLIST2, is useful for affirming the adherence to these conventions in all three data bases. A sample report is shown in Attachment 3.

#### Casualty Reports

All the casualty reports are assembled in one directory. They are usually taken from fields "Unit Name", "Date", "Total On-hand Personnel", "Total Replacement Personnel", Total Returning Personnel" and fields 33 through 37 of the Unit Data file. The percentage and ratios listed in these reports are calculated from that data.

For the Kursk Database, all casualty reports are assumed to be as of 1800 hours of the day of the record. All losses and other events are reported for the previous 24 hours. This time convention is adopted, since the opposing armies report most of their activities at the end of the day, in reports filed between 1800 and 2400. The German data in the Ardennes data base is reported at the beginning of the day. Therefore, some casualty reports calculate the percentage of casualties based upon the strength figure being the strength for the beginning of the day, and some calculate based upon the strength figure being at the end of the day. The "Beginning of Day" reports calculate the casualty percentages by dividing the losses by the reported strength. The "End of Day" reports calculated the casualty percentages adding the losses suffered that day to the strength of the unit, and subtracting out the replacements and return to duties received that day. This produces the strength figure for the beginning of the day (actually for 18:00 the previous day). The losses are then divided by the revised strength figures.

A list of which strength calculation methodology the reports use is listed below. For the Kursk data base, only those reports that deal with "end of day" strength" should be used. The beginning of the day strength reports should only be used for the Ardennes German data.

  | No. | Report   | Strength used             |
  | --- | -------- | ------------------------- |
  | 1   | CASSUM   | End-of-day strength       |
  | 2   | MEDRPT   | End-of-day strength       |
  | 3   | DELTACAS | End-of-day strength       |
  | 4   | BIGBAMBI | End-of-day strength       |
  | 5   | NAZIDCAS | Beginning-of-day strength |
  | 6   | UTOTCAS  | Beginning-of-day strength |
  | 7   | UTOTCAS2 | End-of-day strength       |
  | 8   | UTCNDNBI | Beginning-of-day strength |

Sample copies of these reports are provided in Attachment 3. They are described below:

1\. Total Casualties for a Nation or Side for Each Day (CASSUM).

This report lists personnel on hand, replacements, returns to duty, total casualties, killed in action, wounded in action, missing in action, disease and non-battle injuries, the percentage of casualties of overall strength, battle casualties (killed, wounded and captured and missing), bloody casualties (killed and wounded), plus a total of killed and wounded in action. The percentages are calculated as if the strength figure is an end-of-day figure.

2\. Medical Casualties and Rates for Each Unit Each Day (MEDRPT)

These include total forces at the beginning of the day, total killed in action, total wounded in action, total disease and non-battle injuries, the percentage of killed in action to the overall figure, the percentage of wounded in action to the overall figure, and the percentage of disease and non-battle injuries to the overall figure. The percentages are calculated as if the strength figure is an end-of-day figure.

3\. US Return-to-Duty Tracking Report (DELTACAS)

This report calculates what the strength of a unit should be based upon its previous day strength, subtracting casualties, and adding in returns-to-duty and replacements. It then provides the total change and a calculated strength from those figures. The program also compares this calculated strength to the reported strength and reports the difference under a column labeled "Delta". This report is useful for proofing the data base. The calculations are based upon the assumption that the strength data is reported for the end of the day. This report, with a revision for the units selected, will be usable for the German and Soviet Units in the Kursk Data Base.

4\. Comprehensive Casualty Report (BIGBAMBI)

This report lists casualties by individual units for each day. It records the unit strength (EOD), replacements, RTDs, total casualties, number killed, wounded, missing and disease and non-battle injuries; plus it calculates the percentage of casualties, battlefield casualties, bloody casualties based upon the end-of-day strength of the unit. It also calculates the ratio of killed to wounded.

5\. German Return-to-Duty Report (NAZIDCAS)

This report calculates what the strength of a unit should be based upon its previous day strength, subtracting casualties, and adding in returns-to-duty and replacements. It then provides the total change and a calculated strength from those figures. The program also compares this calculated strength to the reported strength and reports the difference under a column labeled "Delta". This report is useful for proofing the data base. The calculations are based upon the assumption that the strength data is reported for the beginning of the day. This is done by using the strength for the reported day, but using the casualty, replacements and RTD's from the previous day. So when this report states the casualties for a given day, these are actually the casualties for the previous day.

6\. Total Daily Casualties by Unit Using BOD Strengths (UTOTCAS) The UTOTCAS reports are similar to BIGBAMBI except they do not list the replacements, RTD, nor calculate bloody casualties. UTOTCAS records the unit strength (BOD), total casualties, number killed, wounded, missing and disease and non-battle injuries; plus calculates the percentage of casualties and battlefield casualties based upon the beginning-of-day strength of the unit. It also calculates the ratio of killed to wounded.

7\. Total Daily Casualties by Unit Using EOD Strengths (UTOTCS2)

The UTOTCAS reports are the similar to BIGBAMBI except they do not list the replacements, RTD, nor calculate bloody casualties. UTOTCS2 records the unit strength (EOD), total casualties, number killed, wounded, missing and disease and non-battle injuries; plus it calculates the percentage of casualties and battlefield casualties based upon the end-of-day strength of the unit. It also calculates the ratio of killed to wounded.

8\. Daily Unit Battle Casualties Report (UTCNDNB1) This report is a simpler version of the above reports and lists total battle casualties and their percentage of casualties based upon the beginning-of-day strengths.

#### Other Reports

These are a miscellaneous collection of reports, often created for special purposes.

1\. Time in Combat Report (TIMCBT)

This report tracks the amount of time each unit was in combat for each day, and lists the time it initiated combat and ended it. The data is drawn from fields 1, 2, 42, 43, 44 and 45 of the Unit Location file. A sample of this report is provided in attachment 3.

2\. Unit Command Hierarchy Search and Report (IMPUS).

This report assembles the chain of command for the unit based upon the data reported in the Unit Location file field 4 (Parent Unit). The report will ask the user for a unit and a day, and then will review the Unit Location file and identify which unit is its parent unit. It will then look that unit up and identify its parent unit, and will reiterate this procedure until it encounters a unit whose parent is not tracked in the data base. It will then print out the hierarchy of command above the unit selected. A sample of this report is provided in attachment 3.

3\. Authorized Strength Report (AUTHSTR).

This report takes the authorized strength of a requested unit from the TO&E file, determines from fields 60 through 79 of the Unit Data file which units were attached or detached from it on a given day. It then selects the authorized strength for the attached units from the TO&E file and calculates what the total strength of the unit, with all attachments and detachments, should be. For this program to run properly, the unit names in fields 60 through 79 of the Unit Data file must match those in the "Unit Name" fields of the TO&E Data file. No sample is provided as complete agreement between the two files does not exist in either the Ardennes or the Kursk data base.

Report numbers four through eight were specifically designed to help proof the attachment and detachment of US units below Division level. There is a separate report written for tracking various unit types like Field Artillery, AA units, etc. They are not used in the Kursk project, but similar reports may be developed for German and Soviet units in the Kursk Data Base. They are:

4\. FA Unit Attachment/Detachment Tracking (FAATCH)

5\. Cavalry Unit Attachment/Detachment Tracking (CAVATCH)

6\. TD Unit Attachment/Detachment Tracking (TDATCH)

7\. Chemical Mortar Unit Attachment/Detachment Tracking (CMLATCH)

8\. AAA Unit Attachment/Detachment Tracking (AAAATCH)

Samples of these reports are provided in attachment 3.

9\. Chronological Attachment/Detachment List by Unit (ADLIST)

This report provides a list by unit of what subordinate units were attached to and detached from a given unit by day. This report is taken from fields "Date" and 60 through 79 of the Unit Data records. A sample of this report is provided in attachment 3.

## VI. Miscellaneous

### A. Browse mode

Within dBase is a "browse" function that allows the user to view the data in a column and row format as opposed to using the existing data screens. This format shows each field as a column while each record is a row. This mode is useful for correcting, duplicating or proofing data from the same field for all the records of a unit. The easiest way to enter browse mode is to log-on and select the VIEW or EDIT option of the file the user wishes to browse. Then exit out of that file, exit out of the Kursk Data Base Main Menu, and then exit out of the Historical Data Bases Main Menu. This will bring you to the completion of step 8 of the log-off procedure. Instead of typing "quit" at the dot prompt, type "brow". A browse screen will then appear, displaying the file that the user is accessing. It will start at the record the user was in when they exited the normal program structure.

In browse mode, the user can move through the records easily using the four direction arrows, and the forward and back tab keys (Shift-Tab). One can edit each field in either insert or typeover mode. Memo fields must still be opened by "Control-Home". Data can be duplicated within a field from the record "above" it by moving the curser to the field the user wants the data duplicated in and typing "Control-F8".

It is also possible to add records in the browse mode. This has an advantage over the ENTER menus in that you can go back into a record added and edit it while in browse mode. To add an record just page down (use the "Page Down" key) to the bottom of the file, a statement will appear at the bottom of the screen stating "Add new records? (Y/N)". To add a record just type "Y". If the user continues to move the cursor down, additional records will be added.

To exit browse mode, type "Control-End". This will save the changes and exit the data base. Using the "Escape" key will exit the data base without making changes. One can also exit using the menu bar by typing "F10" to get the menu bar, user the arrow keys to move the selection to the far right labeled "Exit", and hitting return where it has highlighted "Exit". In all exiting from browse mode, the user will return one back to the dot prompt. From there, unless the user is familiar with the dBase commands, it is best to exit the data base by typing "quit" and reenter it (type "dBase") to access the main menu in order to select another data base and file.

A sample of some records displayed in browse mode is attached at the end of this section.

### B. Deleting records

Entire records can only be deleted in browse mode. This is done by moving the cursor over the record to be deleted and hitting "Control-U". This will tag the record as one to be deleted and a small "del" will appear at the top of that screen. Multiple records can be tagged for deletion and all of those so tagged will show the "del" word whenever the cursor is on that record. Records can also be "untagged" for deletion by highlighting the same record with the cursor and hitting "Control-U". To actually delete the records the user must exit browse mode and at the dot prompt that appears upon exit type "Pack". This will delete all the tagged records.

It is expected that only the organization developing the data base will have a need to delete records in the data base.

### C. Sorting the data base

The data base can be sorted by using the menu bar in browse mode. This should not be done by someone with only a casual acquaintance with the software. The records within the data base are sorted in the following manner on the listed fields. All fields are sorted in ascending order.

  | File         | Sorted on (ascending)                    |
  | ------------ | ---------------------------------------- |
  | WEAPONS      | NATION, CATEGORY, WPN_NAME               |
  | TO&E         | NATION, UNIT_SIZE, UNIT_NAME             |
  | INVENTORY    | NATION, UNIT_SIZE, UNIT_NAME, DATE, PAGE |
  | UNIT DATA    | NATION, UNIT_SIZE, UNIT_NAME, DATE       |
  | LOCATION     | NATION, UNIT_SIZE, UNIT_NAME, DATE       |
  | REFERENCE    | SOURCES                                  |
  | AIR          | NATION, DAY, UNIT, AC_NAME, SORTIES      |
  | BIBLIOGRAPHY | BIBLIOG_NO                               |

## Attachment 1: The main menu

## Attachment 2: The records

## Attachment 3: The reports

## Attachment 4: Data base structure
