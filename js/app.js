document.addEventListener('DOMContentLoaded', function() {
            // Main application state
            const app = {
                tables: {},
                relationships: [],
                nextTableId: 1,
                nextRelationshipId: 1,
                selectedTable: null,
                selectedRelationship: null,
                editingTable: null,
                editingColumn: null,
                isDragging: false,
                dragOffsetX: 0,
                dragOffsetY: 0,
                zoomLevel: 1,
                canvasOffset: { x: 0, y: 0 },
                tooltip: null,
                fileImport: {
                    file: null,
                    data: null,
                    headers: [],
                    preview: [],
                    columnTypes: {},
                    columnSettings: []
                }
            };

            // DOM Elements
            const canvas = document.getElementById('canvas');
            const canvasContainer = document.getElementById('canvas-container');
            const tableList = document.getElementById('table-list');
            const newTableBtn = document.getElementById('new-table-btn');
            const importFileBtn = document.getElementById('import-file-btn');
            const exportBtn = document.getElementById('export-btn');
            const importBtn = document.getElementById('import-btn');
            const clearBtn = document.getElementById('clear-btn');
            const zoomInBtn = document.getElementById('zoom-in');
            const zoomOutBtn = document.getElementById('zoom-out');
            const zoomLevelEl = document.getElementById('zoom-level');

            // Modals
            const tableModal = document.getElementById('table-modal');
            const tableModalTitle = document.getElementById('table-modal-title');
            const tableModalSave = document.getElementById('table-modal-save');
            const tableModalCancel = document.getElementById('table-modal-cancel');
            const tableModalClose = document.getElementById('table-modal-close');
            const tableNameInput = document.getElementById('table-name');
            const colorOptions = document.querySelectorAll('.color-option');

            const columnModal = document.getElementById('column-modal');
            const columnModalTitle = document.getElementById('column-modal-title');
            const columnModalSave = document.getElementById('column-modal-save');
            const columnModalCancel = document.getElementById('column-modal-cancel');
            const columnModalClose = document.getElementById('column-modal-close');
            const columnNameInput = document.getElementById('column-name');
            const columnTypeSelect = document.getElementById('column-type');
            const columnPrimaryKey = document.getElementById('column-primary-key');
            const columnNotNull = document.getElementById('column-not-null');
            const columnForeignKey = document.getElementById('column-foreign-key');
            const foreignKeyOptions = document.getElementById('foreign-key-options');
            const referencesTable = document.getElementById('references-table');
            const referencesColumn = document.getElementById('references-column');

            // Import File Modal
            const importFileModal = document.getElementById('import-file-modal');
            const importFileModalClose = document.getElementById('import-file-modal-close');
            const importFileModalCancel = document.getElementById('import-file-modal-cancel');
            const importFileModalCreate = document.getElementById('import-file-modal-create');
            const importFileInput = document.getElementById('import-file');
            const fileName = document.getElementById('file-name');
            const importProgress = document.getElementById('import-progress');
            const fileProgressBar = document.getElementById('file-progress-bar');
            const dataPreviewContainer = document.getElementById('data-preview-container');
            const dataPreview = document.getElementById('data-preview');
            const tableNameFromFile = document.getElementById('table-name-from-file');
            const columnSettings = document.getElementById('column-settings');
            const importFileColorOptions = document.querySelectorAll('#import-file-modal .color-option');

            const exportModal = document.getElementById('export-modal');
            const exportModalClose = document.getElementById('export-modal-close');
            const exportModalCloseBtn = document.getElementById('export-modal-close-btn');
            const exportFormat = document.getElementById('export-format');
            const exportOutput = document.getElementById('export-output');
            const exportCopy = document.getElementById('export-copy');
            const exportDownload = document.getElementById('export-download');

            const importModal = document.getElementById('import-modal');
            const importModalClose = document.getElementById('import-modal-close');
            const importModalCancel = document.getElementById('import-modal-cancel');
            const importModalImport = document.getElementById('import-modal-import');
            const importData = document.getElementById('import-data');

            // Initialize tooltip
            function initTooltip() {
                app.tooltip = document.createElement('div');
                app.tooltip.className = 'tooltip';
                document.body.appendChild(app.tooltip);
            }

            // Show tooltip
            function showTooltip(text, x, y) {
                app.tooltip.textContent = text;
                app.tooltip.style.left = `${x}px`;
                app.tooltip.style.top = `${y}px`;
                app.tooltip.classList.add('visible');
            }

            // Hide tooltip
            function hideTooltip() {
                app.tooltip.classList.remove('visible');
            }

            // Generate unique IDs
            function generateTableId() {
                return `table_${app.nextTableId++}`;
            }

            function generateRelationshipId() {
                return `relationship_${app.nextRelationshipId++}`;
            }

            // Create a new table
            function createTable(name, x, y, color = '#3498db') {
                const id = generateTableId();
                
                app.tables[id] = {
                    id,
                    name,
                    x,
                    y,
                    color,
                    columns: []
                };
                
                renderTable(id);
                renderTableList();
                
                return id;
            }

            // Delete a table
            function deleteTable(tableId) {
                // Remove all relationships connected to this table
                app.relationships = app.relationships.filter(rel => {
                    if (rel.sourceTable === tableId || rel.targetTable === tableId) {
                        const lineEl = document.getElementById(`relationship-${rel.id}`);
                        if (lineEl) lineEl.remove();
                        return false;
                    }
                    return true;
                });
                
                // Remove table element from DOM
                const tableEl = document.getElementById(tableId);
                if (tableEl) tableEl.remove();
                
                // Remove from tables object
                delete app.tables[tableId];
                
                // Update table list
                renderTableList();
            }

            // Add a column to a table
            function addColumn(tableId, column) {
                app.tables[tableId].columns.push(column);
                renderTable(tableId);
                
                // If this is a foreign key, create relationship
                if (column.isForeignKey && column.references) {
                    createRelationship(tableId, column.name, column.references.table, column.references.column);
                }
            }

            // Update a column
            function updateColumn(tableId, columnIndex, updatedColumn) {
                const table = app.tables[tableId];
                const oldColumn = table.columns[columnIndex];
                
                // Check if foreign key status has changed
                const foreignKeyChanged = 
                    oldColumn.isForeignKey !== updatedColumn.isForeignKey ||
                    (updatedColumn.isForeignKey && (
                        !oldColumn.references ||
                        oldColumn.references.table !== updatedColumn.references.table ||
                        oldColumn.references.column !== updatedColumn.references.column
                    ));
                
                // Update column
                table.columns[columnIndex] = updatedColumn;
                
                // Handle relationship changes
                if (foreignKeyChanged) {
                    // Remove any existing relationship for this column
                    app.relationships = app.relationships.filter(rel => {
                        if (rel.sourceTable === tableId && rel.sourceColumn === oldColumn.name) {
                            const lineEl = document.getElementById(`relationship-${rel.id}`);
                            if (lineEl) lineEl.remove();
                            return false;
                        }
                        return true;
                    });
                    
                    // Create new relationship if needed
                    if (updatedColumn.isForeignKey && updatedColumn.references) {
                        createRelationship(
                            tableId, 
                            updatedColumn.name, 
                            updatedColumn.references.table, 
                            updatedColumn.references.column
                        );
                    }
                }
                
                renderTable(tableId);
            }

            // Delete a column
            function deleteColumn(tableId, columnIndex) {
                const table = app.tables[tableId];
                const column = table.columns[columnIndex];
                
                // Remove any relationships associated with this column
                app.relationships = app.relationships.filter(rel => {
                    if ((rel.sourceTable === tableId && rel.sourceColumn === column.name) ||
                        (rel.targetTable === tableId && rel.targetColumn === column.name)) {
                        const lineEl = document.getElementById(`relationship-${rel.id}`);
                        if (lineEl) lineEl.remove();
                        return false;
                    }
                    return true;
                });
                
                // Remove the column
                table.columns.splice(columnIndex, 1);
                renderTable(tableId);
            }

            // Create a relationship between two tables
            function createRelationship(sourceTableId, sourceColumnName, targetTableId, targetColumnName) {
                const id = generateRelationshipId();
                
                app.relationships.push({
                    id,
                    sourceTable: sourceTableId,
                    sourceColumn: sourceColumnName,
                    targetTable: targetTableId,
                    targetColumn: targetColumnName
                });
                
                renderRelationship(id);
                return id;
            }

            // Render a table on the canvas
            function renderTable(tableId) {
                const table = app.tables[tableId];
                let tableEl = document.getElementById(tableId);
                
                if (!tableEl) {
                    tableEl = document.createElement('div');
                    tableEl.id = tableId;
                    tableEl.className = 'table-card';
                    canvas.appendChild(tableEl);
                    
                    // Make the table draggable
                    tableEl.addEventListener('mousedown', handleTableDragStart);
                }
                
                tableEl.style.left = `${table.x}px`;
                tableEl.style.top = `${table.y}px`;
                
                // Generate HTML content
                tableEl.innerHTML = `
                    <div class="table-card-header" style="background-color: ${table.color};">
                        <span>${table.name}</span>
                        <div class="table-list-item-actions">
                            <button class="edit-table-btn" data-id="${tableId}" title="Edit table">✏️</button>
                            <button class="delete-table-btn" data-id="${tableId}" title="Delete table">🗑️</button>
                        </div>
                    </div>
                    <div class="table-card-body">
                        <ul class="column-list">
                            ${table.columns.map((column, index) => `
                                <li class="column-item" data-table-id="${tableId}" data-column-index="${index}">
                                    <span class="column-name">${column.name}</span>
                                    <span class="column-type">${column.type}</span>
                                    ${column.isPrimaryKey ? '<span class="column-icon primary-key" title="Primary Key">🔑</span>' : ''}
                                    ${column.isForeignKey ? '<span class="column-icon foreign-key" title="Foreign Key">🔗</span>' : ''}
                                    ${column.isNotNull ? '<span class="column-icon not-null" title="Not Null">*</span>' : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="table-card-footer">
                        <button class="btn btn-success add-column-btn" data-id="${tableId}">Add Column</button>
                    </div>
                `;
                
                // Add event listeners for table and column actions
                const editTableBtn = tableEl.querySelector('.edit-table-btn');
                const deleteTableBtn = tableEl.querySelector('.delete-table-btn');
                const addColumnBtn = tableEl.querySelector('.add-column-btn');
                const columnItems = tableEl.querySelectorAll('.column-item');
                
                editTableBtn.addEventListener('click', () => openEditTableModal(tableId));
                deleteTableBtn.addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete the table "${table.name}"?`)) {
                        deleteTable(tableId);
                    }
                });
                
                addColumnBtn.addEventListener('click', () => openAddColumnModal(tableId));
                
                columnItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const tableId = item.getAttribute('data-table-id');
                        const columnIndex = parseInt(item.getAttribute('data-column-index'));
                        openEditColumnModal(tableId, columnIndex);
                    });
                });
                
                // Update any relationships connected to this table
                app.relationships.forEach(rel => {
                    if (rel.sourceTable === tableId || rel.targetTable === tableId) {
                        renderRelationship(rel.id);
                    }
                });
            }

            // Render table list in sidebar
            function renderTableList() {
                tableList.innerHTML = '';
                
                Object.values(app.tables).forEach(table => {
                    const li = document.createElement('li');
                    li.className = 'table-list-item';
                    if (app.selectedTable === table.id) {
                        li.classList.add('active');
                    }
                    
                    li.innerHTML = `
                        <span>${table.name}</span>
                        <div class="table-list-item-actions">
                            <button class="edit-table-btn" data-id="${table.id}" title="Edit table">✏️</button>
                            <button class="delete-table-btn" data-id="${table.id}" title="Delete table">🗑️</button>
                        </div>
                    `;
                    
                    li.addEventListener('click', () => {
                        selectTable(table.id);
                    });
                    
                    const editBtn = li.querySelector('.edit-table-btn');
                    const deleteBtn = li.querySelector('.delete-table-btn');
                    
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditTableModal(table.id);
                    });
                    
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the table "${table.name}"?`)) {
                            deleteTable(table.id);
                        }
                    });
                    
                    tableList.appendChild(li);
                });
            }

            // Render a relationship line
            function renderRelationship(relationshipId) {
                const relationship = app.relationships.find(r => r.id === relationshipId);
                if (!relationship) return;
                
                const sourceTable = app.tables[relationship.sourceTable];
                const targetTable = app.tables[relationship.targetTable];
                
                if (!sourceTable || !targetTable) return;
                
                let relationshipEl = document.getElementById(`relationship-${relationshipId}`);
                
                if (!relationshipEl) {
                    relationshipEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    relationshipEl.id = `relationship-${relationshipId}`;
                    relationshipEl.className = 'relationship-line';
                    relationshipEl.setAttribute('data-id', relationshipId);
                    canvas.appendChild(relationshipEl);
                    
                    relationshipEl.addEventListener('click', () => {
                        selectRelationship(relationshipId);
                    });
                }
                
                // Calculate connector positions
                const sourceEl = document.getElementById(relationship.sourceTable);
                const targetEl = document.getElementById(relationship.targetTable);
                
                if (!sourceEl || !targetEl) return;
                
                const sourceRect = sourceEl.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const sourceX = sourceTable.x + sourceRect.width;
                const sourceY = sourceTable.y + sourceRect.height / 2;
                const targetX = targetTable.x;
                const targetY = targetTable.y + targetRect.height / 2;
                
                // Calculate path
                const midX = (sourceX + targetX) / 2;
                
                // Create SVG content
                relationshipEl.setAttribute('width', canvas.clientWidth);
                relationshipEl.setAttribute('height', canvas.clientHeight);
                
                relationshipEl.innerHTML = `
                    <path d="M ${sourceX} ${sourceY} 
                             C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}"
                          stroke-dasharray="${relationship.sourceColumn.includes('id') ? 'none' : '4,4'}" />
                    <polygon class="relationship-line-endpoint" 
                             points="${targetX},${targetY} ${targetX-10},${targetY-5} ${targetX-10},${targetY+5}" />
                `;
                
                if (app.selectedRelationship === relationshipId) {
                    relationshipEl.classList.add('selected');
                } else {
                    relationshipEl.classList.remove('selected');
                }
            }

            // Select a table
            function selectTable(tableId) {
                // Deselect previous selections
                if (app.selectedTable) {
                    const prevTableEl = document.getElementById(app.selectedTable);
                    if (prevTableEl) {
                        prevTableEl.classList.remove('selected');
                    }
                }
                
                if (app.selectedRelationship) {
                    const prevRelEl = document.getElementById(`relationship-${app.selectedRelationship}`);
                    if (prevRelEl) {
                        prevRelEl.classList.remove('selected');
                    }
                    app.selectedRelationship = null;
                }
                
                // Select new table
                app.selectedTable = tableId;
                const tableEl = document.getElementById(tableId);
                if (tableEl) {
                    tableEl.classList.add('selected');
                }
                
                renderTableList();
            }

            // Select a relationship
            function selectRelationship(relationshipId) {
                // Deselect previous selections
                if (app.selectedTable) {
                    const prevTableEl = document.getElementById(app.selectedTable);
                    if (prevTableEl) {
                        prevTableEl.classList.remove('selected');
                    }
                    app.selectedTable = null;
                }
                
                if (app.selectedRelationship) {
                    const prevRelEl = document.getElementById(`relationship-${app.selectedRelationship}`);
                    if (prevRelEl) {
                        prevRelEl.classList.remove('selected');
                    }
                }
                
                // Select new relationship
                app.selectedRelationship = relationshipId;
                const relEl = document.getElementById(`relationship-${relationshipId}`);
                if (relEl) {
                    relEl.classList.add('selected');
                }
                
                renderTableList();
            }

            // Handle starting table drag
            function handleTableDragStart(event) {
                if (event.target.closest('.table-card-header')) {
                    const tableId = event.currentTarget.id;
                    selectTable(tableId);
                    
                    app.isDragging = true;
                    const tableEl = document.getElementById(tableId);
                    const rect = tableEl.getBoundingClientRect();
                    
                    app.dragOffsetX = event.clientX - rect.left;
                    app.dragOffsetY = event.clientY - rect.top;
                    
                    event.preventDefault();
                }
            }

            // Handle table dragging
            function handleTableDrag(event) {
                if (app.isDragging && app.selectedTable) {
                    const containerRect = canvasContainer.getBoundingClientRect();
                    const x = (event.clientX - containerRect.left - app.dragOffsetX + canvasContainer.scrollLeft) / app.zoomLevel;
                    const y = (event.clientY - containerRect.top - app.dragOffsetY + canvasContainer.scrollTop) / app.zoomLevel;
                    
                    app.tables[app.selectedTable].x = x;
                    app.tables[app.selectedTable].y = y;
                    
                    const tableEl = document.getElementById(app.selectedTable);
                    tableEl.style.left = `${x}px`;
                    tableEl.style.top = `${y}px`;
                    
                    // Update relationships
                    app.relationships.forEach(rel => {
                        if (rel.sourceTable === app.selectedTable || rel.targetTable === app.selectedTable) {
                            renderRelationship(rel.id);
                        }
                    });
                }
            }

            // Handle end of table drag
            function handleTableDragEnd() {
                app.isDragging = false;
            }

            // Open modal to create a new table
            function openCreateTableModal() {
                app.editingTable = null;
                tableModalTitle.textContent = 'Create New Table';
                tableModalSave.textContent = 'Create Table';
                tableNameInput.value = '';
                
                // Select first color
                colorOptions.forEach(option => {
                    if (option.classList.contains('color-1')) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
                
                tableModal.style.display = 'flex';
                tableNameInput.focus();
            }

            // Open modal to edit a table
            function openEditTableModal(tableId) {
                const table = app.tables[tableId];
                app.editingTable = tableId;
                
                tableModalTitle.textContent = 'Edit Table';
                tableModalSave.textContent = 'Update Table';
                tableNameInput.value = table.name;
                
                // Select correct color
                colorOptions.forEach(option => {
                    const color = option.getAttribute('data-color');
                    if (color === table.color) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
                
                tableModal.style.display = 'flex';
                tableNameInput.focus();
            }

            // Open modal to add a column
            function openAddColumnModal(tableId) {
                app.editingTable = tableId;
                app.editingColumn = null;
                
                columnModalTitle.textContent = 'Add New Column';
                columnModalSave.textContent = 'Add Column';
                columnNameInput.value = '';
                columnTypeSelect.value = 'int';
                columnPrimaryKey.checked = false;
                columnNotNull.checked = false;
                columnForeignKey.checked = false;
                foreignKeyOptions.style.display = 'none';
                
                // Fill reference tables dropdown
                referencesTable.innerHTML = '';
                Object.values(app.tables).forEach(table => {
                    if (table.id !== tableId) {
                        const option = document.createElement('option');
                        option.value = table.id;
                        option.textContent = table.name;
                        referencesTable.appendChild(option);
                    }
                });
                
                // Handle references table change
                updateReferencesColumnDropdown();
                
                columnModal.style.display = 'flex';
                columnNameInput.focus();
            }

            // Open modal to edit a column
            function openEditColumnModal(tableId, columnIndex) {
                const table = app.tables[tableId];
                const column = table.columns[columnIndex];
                
                app.editingTable = tableId;
                app.editingColumn = columnIndex;
                
                columnModalTitle.textContent = 'Edit Column';
                columnModalSave.textContent = 'Update Column';
                columnNameInput.value = column.name;
                columnTypeSelect.value = column.type;
                columnPrimaryKey.checked = column.isPrimaryKey;
                columnNotNull.checked = column.isNotNull;
                columnForeignKey.checked = column.isForeignKey;
                
                if (column.isForeignKey) {
                    foreignKeyOptions.style.display = 'block';
                } else {
                    foreignKeyOptions.style.display = 'none';
                }
                
                // Fill reference tables dropdown
                referencesTable.innerHTML = '';
                Object.values(app.tables).forEach(table => {
                    if (table.id !== tableId) {
                        const option = document.createElement('option');
                        option.value = table.id;
                        option.textContent = table.name;
                        referencesTable.appendChild(option);
                    }
                });
                
                // Set selected reference table if this is a foreign key
                if (column.isForeignKey && column.references) {
                    referencesTable.value = column.references.table;
                }
                
                // Update references column dropdown
                updateReferencesColumnDropdown();
                
                // Set selected reference column if this is a foreign key
                if (column.isForeignKey && column.references) {
                    referencesColumn.value = column.references.column;
                }
                
                columnModal.style.display = 'flex';
                columnNameInput.focus();
            }

            // Update the references column dropdown based on selected table
            function updateReferencesColumnDropdown() {
                referencesColumn.innerHTML = '';
                
                if (referencesTable.value) {
                    const refTable = app.tables[referencesTable.value];
                    if (refTable) {
                        refTable.columns.forEach(column => {
                            const option = document.createElement('option');
                            option.value = column.name;
                            option.textContent = column.name;
                            referencesColumn.appendChild(option);
                        });
                    }
                }
            }

            // Save a table
            function saveTable() {
                const name = tableNameInput.value.trim();
                
                if (!name) {
                    alert('Please enter a table name.');
                    return;
                }
                
                // Get selected color
                let selectedColor = '#3498db';
                colorOptions.forEach(option => {
                    if (option.classList.contains('selected')) {
                        selectedColor = option.getAttribute('data-color');
                    }
                });
                
                if (app.editingTable) {
                    // Update existing table
                    app.tables[app.editingTable].name = name;
                    app.tables[app.editingTable].color = selectedColor;
                    renderTable(app.editingTable);
                    renderTableList();
                } else {
                    // Create new table
                    createTable(name, 50, 50, selectedColor);
                }
                
                tableModal.style.display = 'none';
            }

            // Save a column
            function saveColumn() {
                const name = columnNameInput.value.trim();
                const type = columnTypeSelect.value;
                const isPrimaryKey = columnPrimaryKey.checked;
                const isNotNull = columnNotNull.checked;
                const isForeignKey = columnForeignKey.checked;
                
                if (!name) {
                    alert('Please enter a column name.');
                    return;
                }
                
                let references = null;
                
                if (isForeignKey) {
                    if (!referencesTable.value || !referencesColumn.value) {
                        alert('Please select a reference table and column.');
                        return;
                    }
                    
                    references = {
                        table: referencesTable.value,
                        column: referencesColumn.value
                    };
                }
                
                const column = {
                    name,
                    type,
                    isPrimaryKey,
                    isNotNull,
                    isForeignKey,
                    references
                };
                
                if (app.editingColumn !== null) {
                    // Update existing column
                    updateColumn(app.editingTable, app.editingColumn, column);
                } else {
                    // Add new column
                    addColumn(app.editingTable, column);
                }
                
                columnModal.style.display = 'none';
            }

            // Open import file modal
            function openImportFileModal() {
                // Reset state
                app.fileImport = {
                    file: null,
                    data: null,
                    headers: [],
                    preview: [],
                    columnTypes: {},
                    columnSettings: []
                };
                
                // Reset UI
                importFileInput.value = '';
                fileName.textContent = '';
                importProgress.style.display = 'none';
                dataPreviewContainer.style.display = 'none';
                dataPreview.innerHTML = '';
                tableNameFromFile.value = '';
                columnSettings.innerHTML = '';
                importFileModalCreate.disabled = true;
                
                // Select first color
                importFileColorOptions.forEach(option => {
                    if (option.classList.contains('color-1')) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
                
                importFileModal.style.display = 'flex';
            }

            // Handle file selection
            function handleFileSelect(event) {
                const file = event.target.files[0];
                if (!file) return;
                
                app.fileImport.file = file;
                fileName.textContent = file.name;
                
                // Auto-fill table name from filename
                const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
                tableNameFromFile.value = nameWithoutExtension.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                
                // Show progress
                importProgress.style.display = 'block';
                fileProgressBar.style.width = '0%';
                
                // Process the file
                processFile(file);
            }

            // Process uploaded file
            function processFile(file) {
                // Check file type
                const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel';
                
                if (fileType === 'csv') {
                    // Parse CSV
                    Papa.parse(file, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: handleParsedData,
                        error: handleParseError,
                        step: function(results, parser) {
                            // Update progress bar
                            const progress = Math.min(100, Math.round((results.meta.cursor / file.size) * 100));
                            fileProgressBar.style.width = `${progress}%`;
                        }
                    });
                } else {
                    // Parse Excel
                    const reader = new FileReader();
                    
                    reader.onprogress = function(event) {
                        if (event.lengthComputable) {
                            const progress = Math.round((event.loaded / event.total) * 100);
                            fileProgressBar.style.width = `${progress}%`;
                        }
                    };
                    
                    reader.onload = function(e) {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                            
                            // Get first sheet
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            
                            // Convert to JSON
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                            
                            // Process data
                            if (jsonData.length > 0) {
                                const headers = jsonData[0];
                                const rows = jsonData.slice(1);
                                
                                // Format data for the handler
                                const formattedData = {
                                    data: rows.map(row => {
                                        const obj = {};
                                        headers.forEach((header, i) => {
                                            obj[header] = row[i];
                                        });
                                        return obj;
                                    }),
                                    meta: { fields: headers }
                                };
                                
                                handleParsedData(formattedData);
                            } else {
                                handleParseError({ message: 'Empty file or no data found' });
                            }
                        } catch (error) {
                            handleParseError(error);
                        }
                    };
                    
                    reader.onerror = function() {
                        handleParseError({ message: 'Error reading file' });
                    };
                    
                    reader.readAsArrayBuffer(file);
                }
            }

            // Handle parsed data
            function handleParsedData(results) {
                // Store data
                app.fileImport.data = results.data;
                app.fileImport.headers = results.meta.fields || [];
                
                // Get a preview of the data (up to 5 rows)
                app.fileImport.preview = results.data.slice(0, 5);
                
                // Determine column types
                inferColumnTypes();
                
                // Render preview
                renderDataPreview();
                
                // Hide progress
                importProgress.style.display = 'none';
                
                // Show preview container
                dataPreviewContainer.style.display = 'block';
                
                // Enable create button
                importFileModalCreate.disabled = false;
            }

            // Handle parse error
            function handleParseError(error) {
                console.error('Error parsing file:', error);
                alert(`Error parsing file: ${error.message}`);
                importProgress.style.display = 'none';
            }

            // Infer column types from data
            function inferColumnTypes() {
                const columnTypes = {};
                const headers = app.fileImport.headers;
                const data = app.fileImport.data;
                
                headers.forEach(header => {
                    // Default to varchar
                    let inferredType = 'varchar';
                    let isId = false;
                    let hasNull = false;
                    
                    // Check if it's an ID column
                    if (header.toLowerCase() === 'id' || header.toLowerCase().endsWith('_id')) {
                        isId = true;
                    }
                    
                    // Sample data for type inference
                    const sampleSize = Math.min(data.length, 20);
                    const samples = [];
                    
                    for (let i = 0; i < sampleSize; i++) {
                        const value = data[i][header];
                        if (value !== undefined && value !== null) {
                            samples.push(value);
                        } else {
                            hasNull = true;
                        }
                    }
                    
                    // Check if all values are numbers
                    const allNumbers = samples.every(val => typeof val === 'number' || !isNaN(parseFloat(val)));
                    
                    // Check if all values are boolean
                    const allBooleans = samples.every(val => 
                        typeof val === 'boolean' || 
                        val === 0 || val === 1 || 
                        val === '0' || val === '1' || 
                        val === 'true' || val === 'false' || 
                        val === 'True' || val === 'False'
                    );
                    
                    // Check if all values look like dates
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{4}\/\d{2}\/\d{2}$|^\d{2}-\d{2}-\d{4}$|^\d{2}\/\d{2}\/\d{4}$/;
                    const allDates = samples.every(val => {
                        if (typeof val === 'string') {
                            return dateRegex.test(val) || !isNaN(Date.parse(val));
                        } else if (val instanceof Date) {
                            return true;
                        }
                        return false;
                    });
                    
                    // Check if all values are short enough for varchar
                    const allShortTexts = samples.every(val => 
                        typeof val !== 'string' || val.length <= 255
                    );
                    
                    // Infer type based on checks
                    if (isId) {
                        inferredType = 'int';
                    } else if (allBooleans) {
                        inferredType = 'boolean';
                    } else if (allDates) {
                        inferredType = 'date';
                    } else if (allNumbers) {
                        // Check if all integers
                        const allIntegers = samples.every(val => {
                            const num = parseFloat(val);
                            return num === Math.floor(num);
                        });
                        
                        inferredType = allIntegers ? 'int' : 'float';
                    } else if (!allShortTexts) {
                        inferredType = 'text';
                    }
                    
                    // Store inferred type
                    columnTypes[header] = inferredType;
                    
                    // Create column settings
                    app.fileImport.columnSettings.push({
                        original: header,
                        name: header.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        type: inferredType,
                        isPrimaryKey: isId && header.toLowerCase() === 'id',
                        isNotNull: !hasNull,
                        include: true
                    });
                });
                
                app.fileImport.columnTypes = columnTypes;
            }

            // Render data preview
            function renderDataPreview() {
                const headers = app.fileImport.headers;
                const preview = app.fileImport.preview;
                
                // Create table header
                let tableHtml = '<thead><tr>';
                headers.forEach(header => {
                    tableHtml += `<th>${header}</th>`;
                });
                tableHtml += '</tr></thead>';
                
                // Create table body
                tableHtml += '<tbody>';
                preview.forEach(row => {
                    tableHtml += '<tr>';
                    headers.forEach(header => {
                        const value = row[header];
                        tableHtml += `<td>${value !== undefined && value !== null ? value : ''}</td>`;
                    });
                    tableHtml += '</tr>';
                });
                tableHtml += '</tbody>';
                
                dataPreview.innerHTML = tableHtml;
                
                // Render column settings
                renderColumnSettings();
            }

            // Render column settings
            function renderColumnSettings() {
                columnSettings.innerHTML = '';
                
                app.fileImport.columnSettings.forEach((column, index) => {
                    const columnSettingItem = document.createElement('div');
                    columnSettingItem.className = 'column-setting-item';
                    
                    columnSettingItem.innerHTML = `
                        <div class="form-check">
                            <input type="checkbox" id="include-column-${index}" ${column.include ? 'checked' : ''}>
                            <label for="include-column-${index}">Include</label>
                        </div>
                        <div class="column-name-input">
                            <input type="text" id="column-name-${index}" value="${column.name}" placeholder="Column name">
                        </div>
                        <div class="column-type-select">
                            <select id="column-type-${index}">
                                <option value="int" ${column.type === 'int' ? 'selected' : ''}>int</option>
                                <option value="varchar" ${column.type === 'varchar' ? 'selected' : ''}>varchar</option>
                                <option value="text" ${column.type === 'text' ? 'selected' : ''}>text</option>
                                <option value="boolean" ${column.type === 'boolean' ? 'selected' : ''}>boolean</option>
                                <option value="date" ${column.type === 'date' ? 'selected' : ''}>date</option>
                                <option value="datetime" ${column.type === 'datetime' ? 'selected' : ''}>datetime</option>
                                <option value="float" ${column.type === 'float' ? 'selected' : ''}>float</option>
                                <option value="double" ${column.type === 'double' ? 'selected' : ''}>double</option>
                                <option value="decimal" ${column.type === 'decimal' ? 'selected' : ''}>decimal</option>
                                <option value="json" ${column.type === 'json' ? 'selected' : ''}>json</option>
                                <option value="blob" ${column.type === 'blob' ? 'selected' : ''}>blob</option>
                            </select>
                        </div>
                        <div class="column-options">
                            <div class="form-check">
                                <input type="checkbox" id="primary-key-${index}" ${column.isPrimaryKey ? 'checked' : ''}>
                                <label for="primary-key-${index}">PK</label>
                            </div>
                            <div class="form-check">
                                <input type="checkbox" id="not-null-${index}" ${column.isNotNull ? 'checked' : ''}>
                                <label for="not-null-${index}">Not Null</label>
                            </div>
                        </div>
                    `;
                    
                    columnSettings.appendChild(columnSettingItem);
                    
                    // Add event listeners
                    const includeCheckbox = columnSettingItem.querySelector(`#include-column-${index}`);
                    const nameInput = columnSettingItem.querySelector(`#column-name-${index}`);
                    const typeSelect = columnSettingItem.querySelector(`#column-type-${index}`);
                    const primaryKeyCheckbox = columnSettingItem.querySelector(`#primary-key-${index}`);
                    const notNullCheckbox = columnSettingItem.querySelector(`#not-null-${index}`);
                    
                    includeCheckbox.addEventListener('change', () => {
                        app.fileImport.columnSettings[index].include = includeCheckbox.checked;
                    });
                    
                    nameInput.addEventListener('input', () => {
                        app.fileImport.columnSettings[index].name = nameInput.value;
                    });
                    
                    typeSelect.addEventListener('change', () => {
                        app.fileImport.columnSettings[index].type = typeSelect.value;
                    });
                    
                    primaryKeyCheckbox.addEventListener('change', () => {
                        app.fileImport.columnSettings[index].isPrimaryKey = primaryKeyCheckbox.checked;
                    });
                    
                    notNullCheckbox.addEventListener('change', () => {
                        app.fileImport.columnSettings[index].isNotNull = notNullCheckbox.checked;
                    });
                });
            }

            // Create table from file data
            function createTableFromFile() {
                const tableName = tableNameFromFile.value.trim();
                
                if (!tableName) {
                    alert('Please enter a table name.');
                    return;
                }
                
                // Get selected color
                let selectedColor = '#3498db';
                importFileColorOptions.forEach(option => {
                    if (option.classList.contains('selected')) {
                        selectedColor = option.getAttribute('data-color');
                    }
                });
                
                // Create new table
                const tableId = createTable(tableName, 50, 50, selectedColor);
                
                // Add columns
                app.fileImport.columnSettings.forEach(column => {
                    if (column.include) {
                        addColumn(tableId, {
                            name: column.name,
                            type: column.type,
                            isPrimaryKey: column.isPrimaryKey,
                            isNotNull: column.isNotNull,
                            isForeignKey: false,
                            references: null
                        });
                    }
                });
                
                // Close modal
                importFileModal.style.display = 'none';
                
                // Select the new table
                selectTable(tableId);
            }

            // Export schema
            function exportSchema() {
                const format = exportFormat.value;
                let output = '';
                
                if (format === 'json') {
                    // Export as JSON
                    const schema = {
                        tables: app.tables,
                        relationships: app.relationships
                    };
                    output = JSON.stringify(schema, null, 2);
                } else if (format === 'sql' || format === 'sqlMysql') {
                    // Export as SQL
                    const isPostgres = format === 'sql';
                    const dialect = isPostgres ? 'PostgreSQL' : 'MySQL';
                    
                    output = `-- Database schema for ${dialect}\n\n`;
                    
                    // Create tables
                    Object.values(app.tables).forEach(table => {
                        output += `CREATE TABLE ${table.name} (\n`;
                        
                        // Columns
                        const columnDefs = table.columns.map(col => {
                            let colDef = `  ${col.name} ${col.type}`;
                            
                            if (col.isNotNull) {
                                colDef += ' NOT NULL';
                            }
                            
                            if (col.isPrimaryKey) {
                                colDef += ' PRIMARY KEY';
                            }
                            
                            return colDef;
                        });
                        
                        output += columnDefs.join(',\n');
                        output += '\n);\n\n';
                    });
                    
                    // Add foreign key constraints
                    app.relationships.forEach(rel => {
                        const sourceTable = app.tables[rel.sourceTable];
                        const targetTable = app.tables[rel.targetTable];
                        
                        if (sourceTable && targetTable) {
                            if (isPostgres) {
                                output += `ALTER TABLE ${sourceTable.name} ADD CONSTRAINT fk_${sourceTable.name}_${rel.sourceColumn} `;
                            } else {
                                output += `ALTER TABLE ${sourceTable.name} ADD `;
                            }
                            
                            output += `FOREIGN KEY (${rel.sourceColumn}) REFERENCES ${targetTable.name}(${rel.targetColumn});\n`;
                        }
                    });
                }
                
                exportOutput.value = output;
                exportModal.style.display = 'flex';
            }

            // Import schema
            function importSchema() {
                const json = importData.value.trim();
                
                if (!json) {
                    alert('Please paste a schema to import.');
                    return;
                }
                
                try {
                    const schema = JSON.parse(json);
                    
                    if (!schema.tables || typeof schema.tables !== 'object') {
                        throw new Error('Invalid schema format.');
                    }
                    
                    // Clear existing tables and relationships
                    clearCanvas();
                    
                    // Import tables
                    for (const id in schema.tables) {
                        const table = schema.tables[id];
                        app.tables[id] = {
                            id,
                            name: table.name,
                            x: table.x || 50,
                            y: table.y || 50,
                            color: table.color || '#3498db',
                            columns: table.columns || []
                        };
                        renderTable(id);
                    }
                    
                    // Import relationships
                    if (Array.isArray(schema.relationships)) {
                        schema.relationships.forEach(rel => {
                            app.relationships.push({
                                id: rel.id,
                                sourceTable: rel.sourceTable,
                                sourceColumn: rel.sourceColumn,
                                targetTable: rel.targetTable,
                                targetColumn: rel.targetColumn
                            });
                            renderRelationship(rel.id);
                        });
                    }
                    
                    // Update next IDs
                    app.nextTableId = Math.max(
                        ...Object.keys(app.tables)
                            .filter(id => id.startsWith('table_'))
                            .map(id => parseInt(id.substring(6))) || [0]
                    ) + 1;
                    
                    app.nextRelationshipId = Math.max(
                        ...app.relationships
                            .filter(rel => rel.id.startsWith('relationship_'))
                            .map(rel => parseInt(rel.id.substring(13))) || [0]
                    ) + 1;
                    
                    renderTableList();
                    importModal.style.display = 'none';
                } catch (err) {
                    alert('Error importing schema: ' + err.message);
                }
            }

            // Clear canvas
            function clearCanvas() {
                // Remove table elements
                Object.keys(app.tables).forEach(tableId => {
                    const tableEl = document.getElementById(tableId);
                    if (tableEl) tableEl.remove();
                });
                
                // Remove relationship elements
                app.relationships.forEach(rel => {
                    const lineEl = document.getElementById(`relationship-${rel.id}`);
                    if (lineEl) lineEl.remove();
                });
                
                // Reset state
                app.tables = {};
                app.relationships = [];
                app.selectedTable = null;
                app.selectedRelationship = null;
                
                renderTableList();
            }

            // Set zoom level
            function setZoom(level) {
                app.zoomLevel = Math.max(0.1, Math.min(2, level));
                canvas.style.transform = `scale(${app.zoomLevel})`;
                canvas.style.transformOrigin = 'top left';
                zoomLevelEl.textContent = `${Math.round(app.zoomLevel * 100)}%`;
                
                // Update relationship lines after zoom
                app.relationships.forEach(rel => {
                    renderRelationship(rel.id);
                });
            }

            // Initialize the application
            function init() {
                // Initialize tooltip
                initTooltip();
                
                // Set up event listeners
                newTableBtn.addEventListener('click', openCreateTableModal);
                importFileBtn.addEventListener('click', openImportFileModal);
                exportBtn.addEventListener('click', exportSchema);
                importBtn.addEventListener('click', () => {
                    importData.value = '';
                    importModal.style.display = 'flex';
                });
                clearBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear the canvas? This will delete all tables and relationships.')) {
                        clearCanvas();
                    }
                });
                
                // Table modal
                tableModalSave.addEventListener('click', saveTable);
                tableModalCancel.addEventListener('click', () => { tableModal.style.display = 'none'; });
                tableModalClose.addEventListener('click', () => { tableModal.style.display = 'none'; });
                
                colorOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        colorOptions.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                    });
                });
                
                // Column modal
                columnModalSave.addEventListener('click', saveColumn);
                columnModalCancel.addEventListener('click', () => { columnModal.style.display = 'none'; });
                columnModalClose.addEventListener('click', () => { columnModal.style.display = 'none'; });
                
                columnForeignKey.addEventListener('change', () => {
                    foreignKeyOptions.style.display = columnForeignKey.checked ? 'block' : 'none';
                });
                
                referencesTable.addEventListener('change', updateReferencesColumnDropdown);
                
                // Import File modal
                importFileInput.addEventListener('change', handleFileSelect);
                importFileModalClose.addEventListener('click', () => { importFileModal.style.display = 'none'; });
                importFileModalCancel.addEventListener('click', () => { importFileModal.style.display = 'none'; });
                importFileModalCreate.addEventListener('click', createTableFromFile);
                
                importFileColorOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        importFileColorOptions.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                    });
                });
                
                // Export modal
                exportFormat.addEventListener('change', exportSchema);
                exportModalClose.addEventListener('click', () => { exportModal.style.display = 'none'; });
                exportModalCloseBtn.addEventListener('click', () => { exportModal.style.display = 'none'; });
                
                exportCopy.addEventListener('click', () => {
                    exportOutput.select();
                    document.execCommand('copy');
                    alert('Copied to clipboard!');
                });
                
                exportDownload.addEventListener('click', () => {
                    const format = exportFormat.value;
                    const extension = format.startsWith('sql') ? 'sql' : 'json';
                    const blob = new Blob([exportOutput.value], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `schema.${extension}`;
                    a.click();
                });
                
                // Import modal
                importModalClose.addEventListener('click', () => { importModal.style.display = 'none'; });
                importModalCancel.addEventListener('click', () => { importModal.style.display = 'none'; });
                importModalImport.addEventListener('click', importSchema);
                
                // Canvas events
                document.addEventListener('mousemove', handleTableDrag);
                document.addEventListener('mouseup', handleTableDragEnd);
                
                canvasContainer.addEventListener('click', (event) => {
                    if (event.target === canvas || event.target === canvasContainer) {
                        if (app.selectedTable) {
                            const tableEl = document.getElementById(app.selectedTable);
                            if (tableEl) {
                                tableEl.classList.remove('selected');
                            }
                            app.selectedTable = null;
                        }
                        
                        if (app.selectedRelationship) {
                            const relEl = document.getElementById(`relationship-${app.selectedRelationship}`);
                            if (relEl) {
                                relEl.classList.remove('selected');
                            }
                            app.selectedRelationship = null;
                        }
                        
                        renderTableList();
                    }
                });
                
                // Zoom controls
                zoomInBtn.addEventListener('click', () => setZoom(app.zoomLevel + 0.1));
                zoomOutBtn.addEventListener('click', () => setZoom(app.zoomLevel - 0.1));
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (event) => {
                    // Delete selected items
                    if (event.key === 'Delete') {
                        if (app.selectedTable) {
                            const tableId = app.selectedTable;
                            const table = app.tables[tableId];
                            if (confirm(`Are you sure you want to delete the table "${table.name}"?`)) {
                                deleteTable(tableId);
                            }
                        }
                    }
                    
                    // Escape to close modals
                    if (event.key === 'Escape') {
                        tableModal.style.display = 'none';
                        columnModal.style.display = 'none';
                        importFileModal.style.display = 'none';
                        exportModal.style.display = 'none';
                        importModal.style.display = 'none';
                    }
                });
            }

            // Initialize the app
            init();
        });