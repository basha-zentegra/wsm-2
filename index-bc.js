ZOHO.CREATOR.init()
  .then(function () {
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

              console.log(formattedToday)

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
                      assignee: task.Assignee.display_value
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
                console.log(timee);
                
               
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
                let modalEl = document.createElement("div");
                modalEl.innerHTML = `


                  <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label" aria-hidden="true">
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
                    <div class="card-header bg-${clrPrio(priority)} text-white">Action Section</div>
                    <div class="card-body">
                        <ul class="nav nav-tabs" id="taskTabs" role="tablist">
                            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#subtasks-${modalId}">Subtasks</button></li>
                            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#logs-${modalId}">Logs</button></li>
                            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#notes-${modalId}">Notes</button></li>
                            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#files-${modalId}">Files</button></li>
                             <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#checklist-${modalId}">Checklist</button></li>
                        </ul>
                        <div class="tab-content mt-3">
                            <div class="tab-pane fade show active" id="subtasks-${modalId}">
                                <div class="mb-3">
                                    <input type="text" id="subtaskName" class="form-control" placeholder="Task Name">
                                    <button class="btn btn-primary mt-2" onclick="addSubtask()">Add Subtask</button>
                                </div>
                                <table class="table table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Task Name</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody id="subtaskList"></tbody>
                                </table>
                            </div>
                            <div class="tab-content mt-3">
                                <div class="tab-pane fade " id="logs-${modalId}">
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
                                <textarea id="noteText" class="form-control" rows="3" placeholder="Enter your note"></textarea>
                                <button class="btn btn-primary mt-2" onclick="addNote()">Add Note</button>
                                <ul id="noteList" class="list-group mt-3"></ul>
                            </div>
                            <div class="tab-pane fade" id="files-${modalId}">
                                <h5>Files</h5>
                                <input type="file" id="fileUpload" class="form-control">
                                <button class="btn btn-primary mt-2" onclick="addFile()">Upload File</button>
                                <ul id="fileList" class="list-group mt-3"></ul>
                            </div>
                            
                            <div class="tab-pane fade " id="checklist-${modalId}">
                                <h5>Checklist</h5>
                                <input type="text" id="checklistItem" class="form-control" placeholder="Enter checklist item">
                                <button class="btn btn-primary mt-2" onclick="addChecklistItem()">Add Item</button>
                                <ul id="checklistList" class="list-group mt-3"></ul>
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
                newUpdate(modalId)
                displayLogs(modalId)
              
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

                console.log("god bless you mamey...........")

                let oldRow = `
                <tr>
                  <td>${new Date().toLocaleDateString()}</td>
                  <td>${log.Started}</td>
                  <td>${log.Ended}</td>
                  <td>${log.Hours_Worked}</td>
                </tr>`;

                logTable.innerHTML += oldRow;

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

            addLogs()
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

            // Fetch log data
            // const logsConfig = {
            //   appName: "internal-project-management-platform",
            //   reportName: "All_Logs"
            // };
            
            
            // ZOHO.CREATOR.API.getAllRecords(logsConfig)
            // .then(function (logsresponse) {
            //   logsresponse.data.forEach(log => {
            //     console.log("Log Response:", log.Task.ID);
            //     console.log("Modal id:", modalId);
            //     if(modalId == log.Task.ID){

            //       console.log("god bless you mamey...........")

            //       let oldRow = `
            //       <tr>
            //         <td>${todayDate}</td>
            //         <td>${log.Started}</td>
            //         <td>${log.Ended}</td>
            //         <td>${log.Hours_Worked}</td>
            //       </tr>`;

            //       logTable.innerHTML += oldRow;

            //     }
                
            //   });
            // });

            
            

            // let newRow = `<tr><td>${new Date().toLocaleDateString()}</td><td>${startTimeStr}</td><td>${endTimeStr}</td><td>${readableTime}</td></tr>`;
            // logTable.innerHTML += newRow;

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





console.log("vanakkam nanbaaaaaa.....")

function addSubtask() {
    let input = document.getElementById("subtaskName");
    let task = input.value.trim();
    if (task !== "") {
        let tableBody = document.getElementById("subtaskList");
        let row = `<tr>
            <td>${task}</td>
            <td class="status">New</td>
            <td>
                <button class='btn btn-warning btn-sm' onclick='updateStatus(this)'>Mark In Progress</button>
                <button class='btn btn-danger btn-sm' onclick='deleteSubtask(this)'>Delete</button>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
        input.value = "";
    }
}
function updateStatus(button) {
    let row = button.parentElement.parentElement;
    let statusCell = row.querySelector(".status");
    if (statusCell.textContent === "New") {
        statusCell.textContent = "In Progress";
        button.textContent = "Mark Completed";
        button.classList.replace("btn-warning", "btn-success");
    } else if (statusCell.textContent === "In Progress") {
        statusCell.textContent = "Completed";
        button.remove();
    }
}
function deleteSubtask(button) {
    button.parentElement.parentElement.remove();
}
function addNote() {
    let noteText = document.getElementById("noteText").value;
    if (noteText.trim() !== "") {
        let noteList = document.getElementById("noteList");
        let li = document.createElement("li");
        li.classList.add("list-group-item");
        li.innerText = noteText;
        noteList.appendChild(li);
        document.getElementById("noteText").value = "";
    }
}
function addFile() {
    let fileInput = document.getElementById("fileUpload");
    if (fileInput.files.length > 0) {
        let fileList = document.getElementById("fileList");
        let li = document.createElement("li");
        li.classList.add("list-group-item");
        li.innerText = fileInput.files[0].name;
        fileList.appendChild(li);
        fileInput.value = "";
    }
}
function addChecklistItem() {
    let checklistItem = document.getElementById("checklistItem").value.trim();
    if (checklistItem !== "") {
        let checklistList = document.getElementById("checklistList");
        let li = document.createElement("li");
        li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
        li.innerHTML = `${checklistItem} <button class='btn btn-success btn-sm' onclick='markChecklistItem(this)'>Mark Done</button>`;
        checklistList.appendChild(li);
        document.getElementById("checklistItem").value = "";
    }
}

function markChecklistItem(button) {
    let li = button.parentElement;
    li.style.textDecoration = "line-through";
    button.remove();
}

console.log("helooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo")



function addLogs(){
  formData = {
    "data" : {
      "Started" : "23-Mar-2020 12:25:43 PM",
      "Ended" : "23-Mar-2020 12:25:43 PM",
      "Hours_Worked": "A simple one line text",
      "Task" : "4717578000000041015",
    }

  }


  var logUpdateConfig = {
    appName: "internal-project-management-platform",
    reportName: "All_Logs",
    data : formData
  }

  ZOHO.CREATOR.API.addRecord(logUpdateConfig).then(function (logUpdateResponse) {
    if (logUpdateResponse.code == 3000) {
      console.log("Record added successfully");
    } else {
      console.log("Error adding record:", logUpdateResponse);
    }
  });
}