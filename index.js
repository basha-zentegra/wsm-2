ZOHO.CREATOR.init().then(function () {
    console.log("Zoho Creator SDK Initialized.");

    const employeeConfig = {
      appName: "internal-project-management-platform",
      reportName: "All_Employee"
    };

    const tasksConfig = {
      appName: "internal-project-management-platform",
      reportName: "Task_Report"
    };

    // Fetch employee data
    ZOHO.CREATOR.API.getAllRecords(employeeConfig)
      .then(function (employeeResponse) {
        console.log("Employee Response:", employeeResponse.data);
        

        const resources = employeeResponse.data.map(employee => {
          // const firstName = employee.Name.first_name;
          // const lastName = employee.Name.last_name;
          // const employeeName = `${firstName} ${lastName}`;
          const employeeName = employee.Name;
          // console.log(employee.ID)

          return {  
            id: employee.ID, // Employee unique ID
            title: employeeName // Full name
          };
        });

        console.log("Transformed Resources:", resources);

        // Fetch task data
        ZOHO.CREATOR.API.getAllRecords(tasksConfig)
          .then(function (tasksResponse) {
            console.log("Tasks Response:---->", tasksResponse.data);

            const today = new Date();
            const formattedToday = today.getDate().toString().padStart(2, '0') + '-' +
              (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getFullYear();

              // console.log(formattedToday)

              const events = tasksResponse.data
                .filter(task => task.Task_Date === formattedToday)
                .map(task => {
                  const startHour = task.Start_Time_Hours;
                  const endHour = task.End_Time_Hours;
                  const employeeId = task.Assignee.ID;

                  

                  return {
                    id: task.ID,
                    resourceIds: [employeeId],
                    // start: createDate(startHour, 0),
                    // end: createDate(endHour, 0),
                    start: createDate(task.Start_Time_Hours, task.Start_Time_Mins), // Start time
                    end: createDate(task.End_Time_Hours, task.End_Time_Mins), // End time
                    title: task.Task_Name, // Only task name
                    extendedProps: {  // ✅ Move description & priority inside extendedProps
                      description: task.Task_Description || "No Description",
                      priority: task.Task_Priority || "No Priority" ,
                      status: task.Task_Status || "No Statusss",
                      start_date: task.Task_Date,
                      end_date: task.Due_Date,
                      assignee: task.Assignee.display_value,
                      Checklist_Template: task.Checklist_Template
                    }
                  };
                });


            console.log("Transformed Events:", events);

            const ec = new EventCalendar(document.getElementById('ec'), {
              resources,
              events,
              view: 'resourceTimeGridDay',
              allDaySlot: false,
              slotMinTime: '08:00:00',
              slotMaxTime: '20:00:00',
              nowIndicator: true,
              selectable: false, // Allow events to be selected
              editable: true, // Allow resizing

              eventDrop: function ({ event, revert }) {
                if (hasOtherOverlappingEvents(event)) {
                  alert("This move overlaps with another event. Action reverted.");
                  revert();
                } else {
                  updateZohoTask(event);
                }
              },   

              eventResize: function ({ event, revert }) {
                if (hasOtherOverlappingEvents(event)) {
                  alert("This resize overlaps with another event. Action reverted.");
                  revert();
                } else {
                  updateZohoTask(event); 
                }
              },          
              
              headerToolbar: {
                start: 'title',
                center: '',
                end: 'today,prev,next'
              },
              titleFormat: function (start, end) {
                const s = `${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`;
                return { html: s };
              },

              eventContent: function(arg) {
                console.log("arg is here....",arg)
                let eventEl = document.createElement("div");
                let modalId = `${arg.event.id}`;
                eventEl.classList.add('drgg');
                

                eventEl.setAttribute("data-bs-toggle", "modal");
                eventEl.setAttribute("data-bs-target", `#${modalId}`);
                let priority = arg.event.extendedProps?.priority || "No Priority";
                let status = arg.event.extendedProps?.status || "No Statuss";
                
                
                let priorityClass = "grey"; 
                if (priority === "High") priorityClass = "green";
                else if (priority === "Medium") priorityClass = "blue";
                else if (priority === "Low") priorityClass = "pink";
              
                eventEl.classList.add(priorityClass);

                eventEl.classList.add("border-start", "border-5", `border-${clrPrio(priority)}`);
                const st =arg.event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const et = arg.event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                
                const timee = calculateTimeDifference(st,et);
                // console.log(timee);
                
               
                eventEl.innerHTML = `
                  <div class="ec-event-title bg-${clrPrio(priority)}">${arg.event.title}</div>
                  <div class="ec-event-description ${retDescription(timee)}">${arg.event.extendedProps?.description || "No Description"}</div>
                  
                  <div class="ec-event-priority">${priority}</div>
                  <div class="ec-event-time ${retPrio(timee)}">
                    ${arg.event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - 
                    ${arg.event.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                `;
                // newUpdate(modalId)
                // <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                let modalEl = document.createElement("div");
                modalEl.innerHTML = `


                  <div class="modal fade " id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label" aria-hidden="false">
                    <div class="modal-dialog modal-xl">
                      <div class="modal-content p-0">

                      <div class="container m-2">
        
                          
                          <div class="card shadow-sm position-relative">
                              <div class="task-card-header bg-${clrPrio(priority)}">
                                  <h5 class="mb-0">Task: ${arg.event.title}</h5>
                                  <div class="timer-container">
                                      <span class="timer me-3" id="taskTimer-${modalId}">00:00:00</span>
                                      <button class="timer-button" id="toggleTimer-${modalId}">
                                          <i class="bi bi-play-circle-fill"></i>
                                      </button>
                                  </div>
                              </div>
                              <div class="card-body">
                                  <div class="table-container">
                                      <div class="card table-card">
                                          <div class="card-header bg-${clrPrio(priority)} text-white">Task Details</div>
                                          <div class="card-body">
                                              <table class="table table-bordered">
                                                  <tr><th>Description</th><td>${arg.event.extendedProps?.description || "No Description"}</td></tr>
                                                  <tr><th>Priority</th><td>${priority}</td></tr>
                                                  <tr><th>Status</th><td id="statusText">${status}</td></tr>
                                                  <tr><th>Start Date</th><td id="startDate">${arg.event.extendedProps?.start_date || "No Start date"}</td></tr>
                                                  <tr><th>End Date</th><td id="endDate">${arg.event.extendedProps?.end_date || "No end date"}</td></tr>
                                                  <tr><th>Employee or Team Name</th><td>${arg.event.extendedProps?.assignee || "No assignee"}</td></tr>
                                              </table>
                                          </div>
                                      </div>
                                      <div class="card table-card ">
                                          <div class="card-header bg-${clrPrio(priority)} text-white">Time & Cost</div>
                                          <div class="card-body">
                                              <table class="table table-bordered">
                                                  <tr><th>Allocated Time</th><td id="allocatedTime">${timee}</td></tr>
                                                  <tr><th>Total Time Worked</th><td id="totalTime-${modalId}">0 hrs</td></tr>
                                                  <tr><th>Employee Rate</th><td>$<span id="employeeRate-${modalId}">50</span>/hr</td></tr>
                                                  <tr><th>Total Amount</th><td>$<span id="totalAmount-${modalId}">0</span></td></tr>
                                              </table>
                                          </div>
                                      </div>
                                  </div>
                                  <!-- Action Section with Tabs -->
                                  <div class="card mt-4">
                                      <div class="card-header bg-${clrPrio(priority)} text-white text-center">Action Section</div>
                                      <div class="card-body">
                                          <ul class="nav nav-tabs pb-4  justify-content-center" id="taskTabs" role="tablist">
                                              <li class="nav-item"><button class="nav-link text-${clrPrio(priority)} active" data-bs-toggle="tab" data-bs-target="#subtasks-${modalId}">Subtasks</button></li>
                                              <li class="nav-item"><button class="nav-link text-${clrPrio(priority)}" data-bs-toggle="tab" data-bs-target="#logs-${modalId}">Logs</button></li>
                                              <li class="nav-item"><button class="nav-link text-${clrPrio(priority)}" data-bs-toggle="tab" data-bs-target="#notes-${modalId}">Notes</button></li>
                                              <li class="nav-item"><button class="nav-link text-${clrPrio(priority)}" data-bs-toggle="tab" data-bs-target="#files-${modalId}">Files</button></li>
                                              <li class="nav-item"><button class="nav-link text-${clrPrio(priority)}" data-bs-toggle="tab" data-bs-target="#checklist-${modalId}">Checklist</button></li>
                                          </ul>
                                          <div class="tab-content mt-3">
                                              <div class="tab-pane fade show active" id="subtasks-${modalId}">
                                                  <div class="mb-3">
                                                      <input type="text" id="subtaskName-${modalId}" class="form-control" placeholder="Task Name">
                                                      <button class="btn btn-${clrPrio(priority)} mt-2" onclick="addSubtask('${modalId}')">Add Subtask</button>
                                                  </div>
                                                  <table class="table table-bordered">
                                                      <thead>
                                                          <tr>
                                                              <th>Task Name</th>
                                                              <th>Status</th>
                                                              <th>Action</th>
                                                          </tr>
                                                      </thead>
                                                      <tbody id="subtaskList-${modalId}"></tbody>
                                                  </table>
                                              </div>
                                              <div class="tab-content mt-3">
                                                  <div class="tab-pane fade " id="logs-${modalId}">
                                                
                                                    <div class="row mb-3">
                                                    
                                                      <div class="col">
                                                      <small class="text-muted text-center">Date</small>
                                                        <input type="date" id="logManualDate-${modalId}" class="form-control" placeholder="DD/MM/YYYY"  required>

                                                      </div>
                                                      <div class="col">
                                                      <small class="text-muted">Started Time</small>
                                                        <input type="text" id="logManualST-${modalId}" class="form-control" placeholder="HH:MM:SS">
                                                      </div>
                                                      <div class="col">
                                                      <small class="text-muted">Fineshed Time</small>
                                                        <input type="text" id="logManualET-${modalId}" class="form-control" placeholder="HH:MM:SS">
                                                      </div>
                                                      <div class="col">
                                                         <button class="btn btn-${clrPrio(priority)} btn-sm my-4" onclick="addNewLogManualy('${modalId}')">Add Log</button>
                                                      </div>

                                                       
                                                    </div>
                                                    
                                                      <h5>Log History</h5>
                                                      <table class="table table-bordered">
                                                          <thead>
                                                              <tr>
                                                                  <th>Date</th>
                                                                  <th>Start Time</th>
                                                                  <th>End Time</th>
                                                                  <th>Hours Worked</th>
                                                                  
                                                              </tr>
                                                          </thead>
                                                          <tbody id="logHistory-${modalId}"></tbody>
                                                      </table>
                                                  </div>
                                              </div>

                                              <div class="tab-pane fade" id="notes-${modalId}">
                                                  <h5>Notes</h5>
                                                  <textarea id="noteText-${modalId}" class="form-control" rows="3" placeholder="Enter your note"></textarea>
                                                  <button class="btn btn-${clrPrio(priority)} mt-2" onclick="addNote('${modalId}')">Add Note</button>
                                                  <ul id="noteList-${modalId}" class="list-group mt-3"></ul>
                                              </div>

                                              <div class="tab-pane fade" id="files-${modalId}">
                                                  <h5>Files</h5>
                                                  <input type="file" id="fileUpload-${modalId}" class="form-control">
                                                  <button class="btn btn-${clrPrio(priority)} mt-2" onclick="addFile('${modalId}')">Upload File</button>
                                                  <ul id="fileList-${modalId}" class="list-group mt-3"></ul>
                                              </div>
                                              
                                              <div class="tab-pane fade " id="checklist-${modalId}">
                                                  <h5>Checklist</h5>  
                                                  
                                                  <div class="row">

                                                    <div class="col">
                                                      <input type="text" id="checklistItem-${modalId}" class="form-control" placeholder="Enter checklist item">
                                                      <button class="btn btn-${clrPrio(priority)} mt-3" onclick="addChecklistItem('${modalId}')">Add Item</button>
                                                    </div>
                                                    
                                                    <div class="col">

                                                      <div  style="height: 100px; overflow-y: auto;" data-bs-spy="scroll" data-bs-target="#navbar-example2" data-bs-root-margin="0px 0px -40%" data-bs-smooth-scroll="true" class="scrollspy-example bg-body-tertiary p-3 rounded-2" tabindex="0">
                                                        
                                                        <div class="form-check form-switch ms-auto">

                                                          <div id="checklistTemplateContiner-${modalId}">

                                                          </div>

                                                          
                                                        </div>
                                                      </div>

                                                    </div>
                                                    
                                                  </div>
                                                  
                                                  <ul id="checklistList-${modalId}" class="list-group mt-3"></ul>
                                              </div>
                                          </div>

                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
    
                      </div>
                    </div>
                  </div>
                  
                  
                `;



                // related js 

                // Append modal to body (to prevent nesting issues)
                document.body.appendChild(modalEl);
                newUpdate(modalId);
                displayLogs(modalId);
                displaySubtask(modalId);
                displayNotes(modalId);
                displayFiles(modalId);
                displayChecklist(modalId);
                getChecklistTemplate().then(t => {

                  // t.map(tt => console.log("map",tt.Checklist_Template.display_value))
                  // console.log("TTTTT",t )

                  // console.log(t.Checklist_Template)
                  const uniqueTemplate = [...new Set(t.map(tt => tt.Checklist_Template.display_value))];
                  console.log(uniqueTemplate)
                  let html = '';
                  uniqueTemplate.forEach(tem => {
                    html += `
                   
                      <input id="switchCheckDefault-${modalId}" onChange='addChecklistTemplate(this, "${tem}", ${JSON.stringify(t)},"${modalId}")' class="form-check-input" type="checkbox" role="switch">
                      <small class="text-muted">${tem}</small><br>
                   
                    `;
                  });
                  document.getElementById(`checklistTemplateContiner-${modalId}`).innerHTML = html;
                });
                
                
                
              
                return { domNodes: [eventEl] };
              }
              

            });
          
            function hasOverlappingEvents(event) {
              const rId = event.resource ? event.resource.id : event.resourceIds[0];
              return ec.getEvents().some(e =>
                e.resourceIds[0] === rId &&
                e.start < event.end &&
                event.start < e.end &&
                e.id !== event.id
              );
            }

            function hasOtherOverlappingEvents(event) {
              return hasOverlappingEvents(event);
            }
          })



          .catch(function (error) {
            console.error("Error fetching task data:", error);
          });
      })
      .catch(function (error) {
        console.error("Error fetching employee data:", error);
      });

      //Getting all Checklist Templates...
      async function getChecklistTemplate(){

        const  CHECKLISTTEMPLATEARRAY = [];

        const templateConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Checklist_Template_Items"
        };

        try {
          const res = await ZOHO.CREATOR.API.getAllRecords(templateConfig);
          res.data.forEach(temp => {
            // CHECKLISTTEMPLATEARRAY.push(temp.Checklist_Template.display_value);
            CHECKLISTTEMPLATEARRAY.push(temp);
            // console.log(temp)
          });
          return CHECKLISTTEMPLATEARRAY;
        } catch (error) {
          console.error("Error fetching checklist template:", error);
          return [];
        }
      
        // ZOHO.CREATOR.API.getAllRecords(templateConfig).then(function (res) {
        //   res.data.forEach(temp => {
        //     // console.log("template-->", temp.Checklist_Template.display_value)
        //     CHECKLISTTEMPLATEARRAY.push(temp.Checklist_Template.display_value);
        //   });
        // });
        // console.log(CHECKLISTTEMPLATEARRAY)

        // if(CHECKLISTTEMPLATEARRAY){
        //   return CHECKLISTTEMPLATEARRAY;
        // }

      }


      //refresh logs.. 
      window.refreshLogs = function(modalId){
        const logTable = document.getElementById(`logHistory-${modalId}`);
        logTable.innerHTML = ""; // clear old logs
      
        const logsConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Logs"
        };
      
        ZOHO.CREATOR.API.getAllRecords(logsConfig).then(function (logsresponse) {
          logsresponse.data.reverse().forEach(log => {
            if (modalId == log.Task.ID) {
              let newRow = `
                <tr>
                  <td>${log.Date_field}</td>
                  <td>${log.Work_Started}</td>
                  <td>${log.Work_Ended}</td>
                  <td>${log.Hours_Worked}</td>
                </tr>`;
              logTable.innerHTML = newRow + logTable.innerHTML; // add on top
            }
          });
        });
      }

      

      //refresh notes.. 
      window.refreshNotes = function(modalId){
        let noteList = document.getElementById(`noteList-${modalId}`);
        noteList.innerHTML = ""; // clear old logs

        
      
        // // Fetch notes data
        const notesConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Notes"
        };

        ZOHO.CREATOR.API.getAllRecords(notesConfig).then(function (notesresponse) {
          notesresponse.data.forEach(note => {
              // console.log("Note Response:", note, modalId, note.Task.ID);
              // console.log("Modal id:", modalId);

              if(modalId == note.Task.ID){


                // console.log("god bless you Machiiii...........")

                let newNote = `<li class="list-group-item">${note.Note}</li>`;
                noteList.innerHTML += newNote;
               
              }
              
            });
          });
      }

      // display NOTES
      const displayNotes = (modalId) =>{

        // let noteText = document.getElementById(`noteText-${modalId}`).value;
        let noteList = document.getElementById(`noteList-${modalId}`);

        // // Fetch notes data
        const notesConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Notes"
        };

        ZOHO.CREATOR.API.getAllRecords(notesConfig).then(function (notesresponse) {
          notesresponse.data.forEach(note => {
              // console.log("Note Response:", note, modalId, note.Task.ID);
              // console.log("Modal id:", modalId);

              if(modalId == note.Task.ID){


                // console.log("god bless you Machiiii...........")

                let newNote = `<li class="list-group-item">${note.Note}</li>`;
                noteList.innerHTML += newNote;
               
              }
              
            });
          });

      }
      

      


      //display the logs... 
      function displayLogs(modalId){
          const logTable = document.getElementById(`logHistory-${modalId}`);
         

          // // Fetch log data
          const logsConfig = {
            appName: "internal-project-management-platform",
            reportName: "All_Logs"
          };
          
          
          ZOHO.CREATOR.API.getAllRecords(logsConfig)
          .then(function (logsresponse) {
            logsresponse.data.forEach(log => {
              // console.log("Log Response:", log);
              // console.log("Modal id:", modalId);
              if(modalId == log.Task.ID){

                // console.log("god bless you mamey...........")

                let oldRow = `
                <tr>
                  <td>${log.Date_field}</td>
                  <td>${log.Work_Started}</td>
                  <td>${log.Work_Ended}</td>
                  <td>${log.Hours_Worked}</td>
                </tr>`;

                logTable.innerHTML += oldRow;

              }
              
            });
          });

      }

      //refresh subtasks.. 
      window.refreshSubtasks = function(modalId){
        const tableBody = document.getElementById(`subtaskList-${modalId}`);
        tableBody.innerHTML = ""; 
      
        const subTaskConfig = {
          appName: "internal-project-management-platform",
          reportName: "Subtask_Report"
        };
      
        ZOHO.CREATOR.API.getAllRecords(subTaskConfig).then(function (subTaskresponse) {
          subTaskresponse.data.reverse().forEach(subtask => {

            const subtaskID = subtask.ID;

            if(modalId == subtask.Task.ID){

              let row = "";

              if(subtask.Status === "New"){
                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       <button class='btn btn-warning btn-sm' onclick='updateStatus(this, "${subtask.Status}", "${subtaskID}", "${modalId}")' > Mark In Progress</button> 
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;
                  
              
              } else if(subtask.Status === "In Progress"){

                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       <button class='btn btn-success btn-sm' onclick='updateStatus(this, "${subtask.Status}", "${subtaskID}", "${modalId}")' > Mark as Done</button> 
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;
                 


              } else if(subtask.Status === "Completed"){

                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;

              }
              tableBody.innerHTML = row + tableBody.innerHTML;


            }
          });
        });
      }


      //display Subtaks
      function displaySubtask(modalId){
        let tableBody = document.getElementById("subtaskList-" + modalId);

        const subTaskConfig = {
          appName: "internal-project-management-platform",
          reportName: "Subtask_Report"
        };
        
        
        ZOHO.CREATOR.API.getAllRecords(subTaskConfig)
        .then(function (subTaskresponse) {
          subTaskresponse.data.forEach(subtask => {
            // console.log("Subtask Response------>:", subtask);
            // console.log("Modal id:------------->", modalId);

            const subtaskID = subtask.ID;

            if(modalId == subtask.Task.ID){

              let row = "";

              if(subtask.Status === "New"){
                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       <button class='btn btn-warning btn-sm' onclick='updateStatus(this, "${subtask.Status}", "${subtaskID}", "${modalId}")' > Mark In Progress</button> 
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;
                  
              
              } else if(subtask.Status === "In Progress"){

                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       <button class='btn btn-success btn-sm' onclick='updateStatus(this, "${subtask.Status}", "${subtaskID}", "${modalId}")' > Mark as Done</button> 
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;
                 


              } else if(subtask.Status === "Completed"){

                row = `<tr>
                  <td>${subtask.Sub_task_Name}</td>
                  <td class="status">${subtask.Status}</td>
                  <td>
                       
                      <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>
                  </td>
                  </tr>`;

              }

              

              
              
              // let row = `<tr>
              //     <td>${subtask.Sub_task_Name}</td>
              //     <td class="status">${subtask.Status}</td>
              //     <td>
              //         <button class='btn btn-warning btn-sm' onclick='updateStatus(this, "${subtask.Status}", "${subtaskID}", "${modalId}")' >Mark In Progress</button> 
              //         <button class='btn btn-danger btn-sm' onclick='deleteSubtask("${subtaskID}", "${modalId}")'>Delete</button>

              //     </td>
              // </tr>`;
              tableBody.innerHTML += row;

            }
            
          });
        });

      }
      //refresh Checklist.. 
      window.refreshChecklist = function(modalId){
        const checklistList = document.getElementById(`checklistList-${modalId}`);

        // checklistList.innerHTML = `
        // <center>
        //   <div class="spinner-border text-center" role="status">
        //     <span class="visually-hidden">Loading...</span>
        //   </div>
        // </center>
        
        // `;
        checklistList.innerHTML = "";

      
        const checklistConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Checklists"
        };
      
        ZOHO.CREATOR.API.getAllRecords(checklistConfig)
        .then(function (Checklistresponse) {

         


          Checklistresponse.data.forEach(checklist => {
            // console.log("Checklist Response------>:", checklist);
            // console.log("Modal id:------------->", modalId);

            if(modalId == checklist.Task.ID){
              let checklistList = document.getElementById(`checklistList-${modalId}`);
              
              const checklisting = `
              <li class="list-group-item d-flex justify-content-between align-items-center ${checklist.Done === 'false' ? '' : 'text-decoration-line-through'}   ">${checklist.List_field} <button class='btn btn-success btn-sm ${checklist.Done === 'false' ? '' : 'd-none'}' onclick="markChecklistItem('${checklist.ID}', '${modalId}')">Mark Done</button></li>
              `;

              checklistList.innerHTML += checklisting;

            }
            
          });
        });
      }

       //display Checklist
       function displayChecklist(modalId){

        const checklistConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Checklists"
        };
        
        
        ZOHO.CREATOR.API.getAllRecords(checklistConfig)
        .then(function (Checklistresponse) {
          Checklistresponse.data.forEach(checklist => {
            // console.log("Checklist Response------>:", checklist);
            // console.log("Modal id:------------->", modalId);

            if(modalId == checklist.Task.ID){
              let checklistList = document.getElementById(`checklistList-${modalId}`);
              
              const checklisting = `
              <li class="list-group-item d-flex justify-content-between align-items-center ${checklist.Done === 'false' ? '' : 'text-decoration-line-through'}   ">${checklist.List_field} <button class='btn btn-success btn-sm ${checklist.Done === 'false' ? '' : 'd-none'}' onclick="markChecklistItem('${checklist.ID}', '${modalId}')">Mark Done</button></li>
              `;

              checklistList.innerHTML += checklisting;

            }
            
          });
        });

      }

       //refresh Files.. 
       window.refreshFiles = function(modalId){
        let fileList = document.getElementById(`fileList-${modalId}`);
        fileList.innerHTML = ""; // clear old logs
      
        const FilesConfig = {
          appName: "internal-project-management-platform",
          reportName: "All_Files"
        };
      
        ZOHO.CREATOR.API.getAllRecords(FilesConfig)
              .then(function (Filesresponse) {
                // console.log("file respojnse:", Filesresponse.data);
                Filesresponse.data.forEach(file => {


                  if(modalId == file.Task.ID){

                    const fullStr = file.File_field;

                    const cleaned = fullStr.replace("/api/v2/32demo1zentegra/internal-project-management-platform/report/All_Files/", "");

                    const newFile =`<li class="list-group-item">${cleaned}</li>`;

                    fileList.innerHTML += newFile;

                  }
                  
                });
              });
      }

            //display Files
            function displayFiles(modalId){

              let fileList = document.getElementById(`fileList-${modalId}`);


              const FilesConfig = {
                appName: "internal-project-management-platform",
                reportName: "All_Files"
              };
              
              
              ZOHO.CREATOR.API.getAllRecords(FilesConfig)
              .then(function (Filesresponse) {
                // console.log("file respojnse:", Filesresponse.data);
                Filesresponse.data.forEach(file => {


                  if(modalId == file.Task.ID){

                    const fullStr = file.File_field;

                    const cleaned = fullStr.replace("/api/v2/32demo1zentegra/internal-project-management-platform/report/All_Files/", "");

                    const newFile =`<li class="list-group-item">${cleaned}</li>`;

                    fileList.innerHTML += newFile;

                  }
                  
                });
              });
      
            }

  })
  .catch(function (error) {
    console.error("Error initializing Zoho Creator SDK:", error);
  });


function createDate(hours, minutes) {
  const now = new Date();
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(0);
  return now;
}

function formatDateTime(date) {
  return date.getFullYear() + "-" +
    (date.getMonth() + 1).toString().padStart(2, '0') + "-" +
    date.getDate().toString().padStart(2, '0') + " " +
    date.getHours().toString().padStart(2, '0') + ":" +
    date.getMinutes().toString().padStart(2, '0') + ":00";
}
// Function to update Zoho Creator when a task is moved/resized
function updateZohoTask(event) {
  const taskId = event.id; // Task unique ID
  const formattedStart = formatDateTime(event.start);
  const formattedEnd = formatDateTime(event.end);

  // console.log("update : records-->",event)
  

  // Fetch Employee ID from the event resource
  const employeeId = event.resourceIds ? event.resourceIds[0] : null; // Ensure Employee ID exists

  if (!employeeId) {
    console.error("❌ Error: Employee ID is missing.");
    return;
  }


  const updateConfig = {
    appName: "internal-project-management-platform",
    reportName: "Task_Report",
    id: taskId,
    data: {
      "data" : {
        "Start_Time_Hours": event.start.getHours(),
        "End_Time_Hours": event.end.getHours(),
        "Start_Time_Mins": event.start.getMinutes(),
        "End_Time_Mins": event.end.getMinutes(),
        "Assignee": employeeId  // Ensure this matches Zoho Creator field name
      }
    }
  };

  ZOHO.CREATOR.API.updateRecord(updateConfig)
    .then(function (response) {
      if (response.code === 3000) {
        console.log("✅ Task updated successfully in Zoho Creator:", response);
      } else {
        console.error("❌ Failed to update task:", response);
      }
    })
    .catch(function (error) {
      console.error("❌ Error updating task in Zoho Creator:", error);
    });

    console.log("Start_Time_No", event.start.getHours(),
      "End_Time_No", event.end.getHours(),
      "Start_Mins_No", event.start.getMinutes(),
      "End_Mins_No", event.end.getMinutes(),
      "Employee_Name", employeeId)
}




function clrPrio(priority){
  if (priority === 'High'){
    return 'success'
  }
  else if(priority === 'Medium'){
    return 'primary'
  }
  else if (priority === 'Low'){
    return 'danger'
  }
  else{
    return 'nopriority'
  }
}


function calculateTimeDifference(startTime, endTime) {
  // Convert time strings to Date objects
  const start = new Date(`01/01/2000 ${startTime}`);
  const end = new Date(`01/01/2000 ${endTime}`);

  // Calculate the difference in milliseconds
  let diffMs = end - start;

  // Convert milliseconds to hours and minutes
  let diffHrs = Math.floor(diffMs / (1000 * 60 * 60)); // Convert to hours
  let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)); // Remaining minutes

  return `${diffHrs} hrs ${diffMins > 0 ? diffMins + " mins" : ""}`.trim();
}

function retDescription(timee) {
  if (timee === '0 hrs 30 mins' || timee === '1 hrs' || timee === '1 hrs 30 mins') {
    return 'd-none';
  } 
  else if(timee === '2 hrs' ) {
    return 'text-limit-1'
  }
  else if(timee === '2 hrs 30 mins' ){
    return 'text-limit-2'
  } else if(timee === '3 hrs' || timee === '3 hrs 30 mins' || timee === '4 hrs' || timee === '4 hrs 30 mins' ){
    return 'text-limit-3'
  }
}

function retPrio(timee) {
  if (timee === '0 hrs 30 mins') {
    return 'd-none';
  } 
}
console.log("hiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii")

// new update 

function newUpdate(modalId) {
    let timerRunning = false;
    let startTime;
    let timerInterval;

    const toggleBtn = document.getElementById(`toggleTimer-${modalId}`);
    const taskTimer = document.getElementById(`taskTimer-${modalId}`);
    const logTable = document.getElementById(`logHistory-${modalId}`);
    const totalTimeElement = document.getElementById(`totalTime-${modalId}`);
    const employeeRateElement = document.getElementById(`employeeRate-${modalId}`);
    const totalAmountElement = document.getElementById(`totalAmount-${modalId}`);
    let todayDate = new Date().toLocaleDateString();

    toggleBtn.addEventListener("click", function () {
        if (!timerRunning) {
            startTime = new Date();
            timerRunning = true;
            this.innerHTML = '<i class="bi bi-stop-circle-fill"></i>';
            startTimer();
        } else {

            
            let endTime = new Date();



            let durationMs = endTime - startTime;
            let totalMinutes = Math.floor(durationMs / 60000);
            let remainingSeconds = Math.floor((durationMs % 60000) / 1000);

            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes % 60;

            let hoursWorked = (durationMs / 3600000); // for total cost calculation
            let readableTime = `${hours}h ${minutes}m ${remainingSeconds}s`;



            let startTimeStr = startTime.toLocaleTimeString();
            let endTimeStr = endTime.toLocaleTimeString();

            addNewLog(modalId, readableTime, startTimeStr, endTimeStr);

            
            
            // displayLogs(modalId);
            // let newRow = `<tr><td>${new Date().toLocaleDateString()}</td><td>${startTimeStr}</td><td>${endTimeStr}</td><td>${readableTime}</td></tr>`;
            // logTable.insertAdjacentHTML("afterbegin", newRow);

            let currentTotal = parseFloat(totalTimeElement.innerText) || 0;
            let updatedTotal = currentTotal + parseFloat(hoursWorked);
            totalTimeElement.innerText = updatedTotal.toFixed(2) + " hrs";

            let rate = parseFloat(employeeRateElement.innerText);
            totalAmountElement.innerText = "$" + (updatedTotal * rate).toFixed(2);

            timerRunning = false;
            this.innerHTML = '<i class="bi bi-play-circle-fill"></i>';
            clearInterval(timerInterval);



            //else content
            
        }
    });

    function startTimer() {
        let start = Date.now();
        timerInterval = setInterval(function () {
            let elapsed = Date.now() - start;
            let hours = Math.floor(elapsed / 3600000);
            let minutes = Math.floor((elapsed % 3600000) / 60000);
            let seconds = Math.floor((elapsed % 60000) / 1000);
            taskTimer.innerText = `${hours.toString().padStart(2, '0')}:${minutes
                .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
}



function addSubtask(modalId) {
    let input = document.getElementById("subtaskName-" + modalId);
    let task = input.value.trim();
    if (task !== "") {
        
        

        addNewSubtask(modalId,task);
        input.value = "";

    }
}
// function updateStatus(button) {
//     let row = button.parentElement.parentElement;
//     let statusCell = row.querySelector(".status");
//     if (statusCell.textContent === "New") {
//         statusCell.textContent = "In Progress";
//         button.textContent = "Mark Completed";
//         button.classList.replace("btn-warning", "btn-success");
//     } else if (statusCell.textContent === "In Progress") {
//         statusCell.textContent = "Completed";
//         button.remove();
//     }
// }
function updateStatus(button,  status, subtaskID, modalId) {

  if (status === "New") {

    var formData = {
      "data" : {
      
        "Status" : "In Progress"
      }
  
    }
  
    var statusUpdateconfig = { 
      appName : "internal-project-management-platform",
      reportName : "Subtask_Report", 
      id : subtaskID,
      data : formData 
    } 
    ZOHO.CREATOR.API.updateRecord(statusUpdateconfig).then(function(response){
      if (response.code == 3000) {
        console.log("Subtask Status updated successfully");
        console.log("before refresh...", button)
        button.innerText = "Updated";
        refreshSubtasks(modalId);
        console.log("After refresh...")
      } else {
        console.log("Error Updating subtask status:", response);
      }
    });

  } else if ((status === "In Progress")){

    
    var formData = {
      "data" : {
      
        "Status" : "Completed"
      }
  
    }
  
    var statusUpdateconfig = { 
      appName : "internal-project-management-platform",
      reportName : "Subtask_Report", 
      id : subtaskID,
      data : formData 
    } 
    ZOHO.CREATOR.API.updateRecord(statusUpdateconfig).then(function(response){
      if (response.code == 3000) {
        console.log("Subtask Status updated successfully");
        console.log("before refresh...")
        refreshSubtasks(modalId);
        console.log("After refresh...")
      } else {
        console.log("Error Updating subtask status:", response);
      }
    });

  }

  // let row = button.parentElement.parentElement;
  // let statusCell = row.querySelector(".status");
  // if (statusCell.textContent === "New") {
  //     statusCell.textContent = "In Progress";
  //     button.textContent = "Mark Completed";
  //     button.classList.replace("btn-warning", "btn-success");
  // } else if (statusCell.textContent === "In Progress") {
  //     statusCell.textContent = "Completed";
  //     button.remove();
  // }
}
// function deleteSubtask(subtaskID){
//   var config = { 
//     appName: "internal-project-management-platform",
//     reportName: "Subtask_Report", 
//     criteria : subtaskID
//   }
//   ZOHO.CREATOR.API.deleteRecord(config).then(function(response){
//   console.log("Record has been deleted");
//   }); 
// }

function deleteSubtask(subtaskID, modalId) {

  // console.log("Helloo da mameyyyyyy abiii", subtaskID, typeof(subtaskID), typeof(modalId) );

  const config = {
      appName: "internal-project-management-platform",
      reportName: "Subtask_Report",
      criteria: `(ID == "${subtaskID}")`
     
  };

  ZOHO.CREATOR.API.deleteRecord(config).then(function(response) {
      if (response.code === 3000) {
          console.log("Deleted successfully");
          refreshSubtasks(modalId); // Refresh the subtask table
      } else{
        console.error("Delete failed da macha: ", response)
      }
  });
}
// "(ID == \"4717578000000782091\" )"

function addNote(modalId) {
  // console.log(`noteText-${modalId}`);
  let noteText = document.getElementById(`noteText-${modalId}`).value;
  if (noteText.trim() !== "") {
  
      addNewNotes(modalId, noteText)

      document.getElementById(`noteText-${modalId}`).value = "";
  }
}

// function addNote() {
//     let noteText = document.getElementById("noteText").value;
//     if (noteText.trim() !== "") {
//         let noteList = document.getElementById("noteList");
//         let li = document.createElement("li");
//         li.classList.add("list-group-item");
//         li.innerText = noteText;
//         noteList.appendChild(li);
//         document.getElementById("noteText").value = "";
//     }
// }

// function addFile() {
//     let fileInput = document.getElementById("fileUpload");
//     if (fileInput.files.length > 0) {
//         let fileList = document.getElementById("fileList");
//         let li = document.createElement("li");
//         li.classList.add("list-group-item");
//         li.innerText = fileInput.files[0].name;
//         fileList.appendChild(li);
//         fileInput.value = "";
//     }
// }

function addFile(modalId) {
  let fileInput = document.getElementById(`fileUpload-${modalId}`).files[0];
  if (fileInput) {
      // let fileList = document.getElementById(`fileList-${modalId}`);
      addNewFile(modalId,fileInput)

      // let li = document.createElement("li");
      // li.classList.add("list-group-item");
      // li.innerText = fileInput.files[0].name;
      // fileList.appendChild(li);
      fileInput.value = "";
  }
}

// function addChecklistItem() {
//     let checklistItem = document.getElementById(`checklistItem-${modalId}`).value.trim();
//     if (checklistItem !== "") {
//         let checklistList = document.getElementById("checklistList");
//         let li = document.createElement("li");
//         li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
//         li.innerHTML = `${checklistItem} <button class='btn btn-success btn-sm' onclick='markChecklistItem(this)'>Mark Done</button>`;
//         checklistList.appendChild(li);
//         document.getElementById("checklistItem").value = "";
//     }
// }
function addChecklistItem(modalId) {
  let checklistItem = document.getElementById(`checklistItem-${modalId}`).value.trim();
  console.log(checklistItem)
  if (checklistItem !== "") {
      addNewChecklistItem(modalId, checklistItem)
      document.getElementById(`checklistItem-${modalId}`).value = "";
  }
}

// function markChecklistItem(button) {
//     let li = button.parentElement;
//     li.style.textDecoration = "line-through";
//     button.remove();
// }

function markChecklistItem(buttonID, modalId) {

  

  // console.log("this is marking function", buttonID, modalId);

  
  var formData = {
    "data" : {
    
      "Done" : true
    }

  }

  var markDoneconfig = { 
    appName : "internal-project-management-platform",
    reportName : "All_Checklists", 
    id : buttonID,
    data : formData 
  } 
  ZOHO.CREATOR.API.updateRecord(markDoneconfig).then(function(response){
    if (response.code == 3000) {
      console.log("Updated checklist successfully");
      refreshChecklist(modalId);
    } else {
      console.log("Error Updating record:", response);
    }
  });
}

// console.log("helooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo")



  
function addNewLog(modalId, readableTime, startTimeStr, endTimeStr){

  const todayDate  = new Date().toLocaleDateString();

  // console.log("New log object.....", modalId, readableTime, startTimeStr, endTimeStr)
  formData = {
    "data" : {
      
      "Hours_Worked": readableTime,
      "Work_Started" : startTimeStr,
      "Work_Ended" : endTimeStr,
      "Task" : modalId,
      "Date_field" : todayDate
      
    }

  }

  var logUpdateConfig = {
    appName: "internal-project-management-platform",
    formName: "Logs",
    data : formData
  }

  ZOHO.CREATOR.API.addRecord(logUpdateConfig).then(function(logUpdateResponse) {
    if (logUpdateResponse.code == 3000) {
      console.log("Record added successfully");
      refreshLogs(modalId);
    } else {
      console.log("Error adding record:", logUpdateResponse);
    }
  });
}

function addNewLogManualy(modalId){

  const rawDate = document.getElementById(`logManualDate-${modalId}`).value;
  const startTime = document.getElementById(`logManualST-${modalId}`).value;
  const endTime = document.getElementById(`logManualET-${modalId}`).value;

  function isValidTimeFormat(time) {
    const pattern = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
    return pattern.test(time);
  }

  if (!rawDate) {
    alert("Please select a valid date");
    return;
  }
    // Compare selected date with today's date
  const selectedDate = new Date(rawDate);
  const today = new Date();
  

  if (selectedDate > today) {
    alert("Future dates are not allowed");
    return;
  }

  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    alert("Please enter time in HH:MM:SS format");
    return;
  }

  
  const [year, month, day] = rawDate.split("-");
  const date = `${day}/${month}/${year}`;

  function calculateTimeDifference(startTime, endTime) {

    const [sh, sm, ss] = startTime.split(':').map(Number);
    const [eh, em, es] = endTime.split(':').map(Number);
  
    const start = new Date();
    start.setHours(sh, sm, ss);
  
    const end = new Date();
    end.setHours(eh, em, es);
  
    let diffInSeconds = Math.floor((end - start) / 1000);
  
    if (diffInSeconds < 0) diffInSeconds += 24 * 3600; // handle crossing midnight
  
    const hours = Math.floor(diffInSeconds / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    const seconds = diffInSeconds % 60;
  
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  const hoursWorked = calculateTimeDifference(startTime, endTime);

  formData = {
    "data" : {
      
      "Hours_Worked": hoursWorked ,
      "Work_Started" : startTime,
      "Work_Ended" : endTime,
      "Task" : modalId,
      "Date_field" : date
      
    }

  }
  var logUpdateConfig = {
    appName: "internal-project-management-platform",
    formName: "Logs",
    data : formData
  }

  ZOHO.CREATOR.API.addRecord(logUpdateConfig).then(function(logUpdateResponse) {
    if (logUpdateResponse.code == 3000) {
      console.log("Log added successfully");
      refreshLogs(modalId);
      document.getElementById(`logManualST-${modalId}`).value = "";
      document.getElementById(`logManualET-${modalId}`).value = "";
      document.getElementById(`logManualDate-${modalId}`).value = "";

    } else {
      console.log("Error adding log:", logUpdateResponse);
    }
  });
  
}

function addNewSubtask(modalId, task){

  subTaskData = {
    "data" : {
      
      "Sub_task_Name": task,
      "Task" : modalId,
      "Status" : "New"
      
    }

  }

  var subTaskAddConfig = {
    appName: "internal-project-management-platform",
    formName: "Subtask",
    data : subTaskData
  }

  ZOHO.CREATOR.API.addRecord(subTaskAddConfig).then(function(subTaskAddResponse) {
    if (subTaskAddResponse.code == 3000) {
      console.log("Record added successfully");
      refreshSubtasks(modalId);
    } else {
      console.log("Error adding record:", subTaskAddResponse);
    }
  });

}

function addNewNotes(modalId, note){

  notesData = {
    "data" : {
      "Note": note,
      "Task" : modalId  
    }

  }
  var notesAddConfig = {
    appName: "internal-project-management-platform",
    formName: "Notes",
    data : notesData
  }

  ZOHO.CREATOR.API.addRecord(notesAddConfig).then(function(notesAddResponse) {
    if (notesAddResponse.code == 3000) {
      console.log("Notes added successfully");
      refreshNotes(modalId);
    } else {
      console.log("Error adding Notes:", notesAddResponse);
    }
  });

}

function addNewFile(modalId, fileInput){

  fileData = {
    "data" : {

      "Task" : modalId  
    }

  }

  var fileAddConfig = {
    appName: "internal-project-management-platform",
    formName: "Files",
    data : fileData
  }

  ZOHO.CREATOR.API.addRecord(fileAddConfig).then(function(fileAddResponse) {
    if (fileAddResponse.code == 3000) {
      console.log("File ID added successfully");
      setTimeout(function() { 
        fetchLatestRecordAndUpload(modalId, fileInput); 
    }, 5); 
      // refreshNotes(modalId);
    } else {
      console.log("Error adding File ID:", fileAddResponse);
    }
  });

}

function fetchLatestRecordAndUpload(modalId, fileInput) {
  
  var config = {
    appName: "internal-project-management-platform",
    reportName: "All_Files",
     
  };

  // Fetch the latest record
  ZOHO.CREATOR.API.getAllRecords(config).then(function(response) {
      if (response.code == 3000 && response.data.length > 0) {
          var latestRecordID = response.data[0].ID; // Get latest record ID
          console.log("Latest Record ID:", latestRecordID);
          uploadFile(modalId, latestRecordID, fileInput); // Upload file to this record
      } else {
          console.log("No records found or API error:", response.message);
      }
  }).catch(function(error) {
      console.error("Error fetching records:", error);
  });
}


function uploadFile(modalId, recordID, fileInput){

  console.log("uploadFile function is called succesfully!!")
  console.log(recordID, fileInput)

  var fileUploadConfig = {
    appName: "internal-project-management-platform",
    reportName: "All_Files",
    id: recordID, 
    fieldName: "File_field", 
    file: fileInput
  }

  ZOHO.CREATOR.API.uploadFile(fileUploadConfig).then(function(response){
    
    if (response.code == 3000) {
      console.log("File uploaded successfully");
      
      const fileInputdel = document.getElementById(`fileUpload-${modalId}`);
      fileInputdel.value= "";
      refreshFiles(modalId);
    } else {
      console.log("Error Uploading File:", response);
    }

   });

}

function addNewChecklistItem(modalId, checklist){

  checklistDatas = {
    "data" : {
      "List_field": checklist,
      "Task" : modalId  
    }

  }
  var checklistAddConfig = {
    appName: "internal-project-management-platform",
    formName: "Checklist",
    data : checklistDatas
  }

  ZOHO.CREATOR.API.addRecord(checklistAddConfig).then(function(checklistAddResponse) {
    if (checklistAddResponse.code == 3000) {
      // console.log("Checklist added successfully");
      refreshChecklist(modalId);
    } else {
      console.log("Error adding Checklist:", checklistAddResponse);
    }
  });

}

function addChecklistTemplate(element, tem, t, modalId ){

  console.log("Gommala..", tem, t, modalId)

  const temID = t.map(tt => tt.Checklist_Template.ID).filter(f => t.Checklist_Template.ID === f)  

  console.log("temID", temID)

  const templateArray = t.filter(template => template.Checklist_Template.display_value === tem).map(template => template.Item_Name)
  const refreshWait = templateArray.length

  if (element.checked) {
  
    console.log("templateArray", templateArray)
    checkListTemplateStore(element ,modalId, tem);
    
    templateArray.forEach((i,index) => {

      checklistDatas = {
        "data" : {
          "List_field": i,
          "Task" : modalId  
        }
      }
      var checklistAddConfig = {
        appName: "internal-project-management-platform",
        formName: "Checklist",
        data : checklistDatas
      }
      ZOHO.CREATOR.API.addRecord(checklistAddConfig).then(function(checklistAddResponse) {
        if (checklistAddResponse.code == 3000) {
          console.log("Checklist added successfully");
          // refreshChecklist(modalId);
          index+1 === refreshWait ? (refreshChecklist(modalId)) : (console.log("Looping for", index+1, "times"))

        } else {
          console.log("Error adding Checklist:", checklistAddResponse);
        }
      });

    }) 
  } else {

    checkListTemplateStore(element ,modalId, tem);

    templateArray.forEach((i,index) => {

      var config = { 
        appName: "internal-project-management-platform",
        reportName : "All_Checklists", 
        criteria : `(List_field == "${i}" && Task == "${modalId}")`
      }
  
      ZOHO.CREATOR.API.deleteRecord(config).then(function(response){
        if (response.code == 3000) {
          console.log("Checklist Deleted successfully");
          index+1 === refreshWait ? (refreshChecklist(modalId)) : (console.log("Looping for", index+1, "times"))

        } else {
          console.log("Error Deleting Checklist:", response);
        }
      });


    })

  }
  
}



function checkListTemplateStore(element, modalId, tem){

  if (element.checked){

    formData = {
      "data" : {
        "Checklist_Template": tem ,
        "Task": modalId
      }
  }
     
    var config = { 
      appName: "internal-project-management-platform",
      formName : "Task_Checklists", 
      data : formData
    }

    ZOHO.CREATOR.API.addRecord(config).then(function(response){
      if (response.code == 3000) {
        console.log("Checklist Template added successfully");
        index+1 === refreshWait ? (refreshChecklist(modalId)) : (console.log("Looping for", index+1, "times"))

      } else {
        console.log("Error Adding Checklist Template:", response);
      }
    });



  } 
  // else {
 
 
  // }
 
 }




























// function checkListTemplateStore(element, modalId){

//  if (element.checked){
//     checklistDatas = {
//       "data" : {
//         "Checklist_Template": true,
        
//       }
//     }

//     var checklistAddTemplateConfig = {
//       appName: "internal-project-management-platform",
//       reportName: "Task_Report",
//       id : modalId,
//       data : checklistDatas
//     }

//     ZOHO.CREATOR.API.updateRecord(checklistAddTemplateConfig).then(function(res) {
//       if (res.code == 3000) {
//         console.log("Checklist Template Stored successfully");
//         // refreshChecklist(modalId);
//       } else {
//         console.log("Error adding Checklist:", res);
//       }
//     });
//  } else {

//   checklistDatas = {
//     "data" : {
//       "Checklist_Template": false,
      
//     }
//   }

//   var checklistAddTemplateConfig = {
//     appName: "internal-project-management-platform",
//     reportName: "Task_Report",
//     id : modalId,
//     data : checklistDatas
//   }

//   ZOHO.CREATOR.API.updateRecord(checklistAddTemplateConfig).then(function(res) {
//     if (res.code == 3000) {
//       console.log("Checklist Template Stored successfully");
//       // refreshChecklist(modalId);
//     } else {
//       console.log("Error adding Checklist:", res);
//     }
//   });


//  }

// }