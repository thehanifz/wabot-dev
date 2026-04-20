document.addEventListener('DOMContentLoaded', () => {
    const configElement = document.getElementById('dashboard-config');
    if (!configElement) return;

    const config = JSON.parse(configElement.textContent || '{}');
    const csrfToken = config.csrfToken;
    const accountsData = new Map((config.accounts || []).map((account) => [account.id, account]));
    const socket = io();

    const modal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const webhookUrlInput = document.getElementById('webhookUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const mediaSettingsContainer = document.getElementById('media-settings-container');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deleteForm = document.getElementById('delete-form');
    const deleteAccountName = document.getElementById('delete-account-name');
    const accountFilter = document.getElementById('account-filter');
    const messageLogBody = document.getElementById('message-log-body');
    const mimeTypeInput = document.getElementById('allowedMimeTypes');

    let mimeTypeList = [];
    let currentMessages = [];

    const setStatusClass = (element, status) => {
        element.className = 'status-span font-semibold';
        if (status === 'connected') element.classList.add('text-green-600');
        else if (status === 'disconnected') element.classList.add('text-red-600');
        else element.classList.add('text-yellow-600');
    };

    const createActionForm = (action, accountId, buttonLabel, buttonClass) => {
        const form = document.createElement('form');
        form.action = action;
        form.method = 'POST';
        form.className = 'inline';

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_csrf';
        csrfInput.value = csrfToken;

        const button = document.createElement('button');
        button.type = 'submit';
        button.className = buttonClass;
        button.textContent = buttonLabel;

        form.appendChild(csrfInput);
        form.appendChild(button);
        return form;
    };

    const renderAccountActions = (account) => {
        const actionsContainer = document.querySelector(`#account-${account.id} .actions-container`);
        if (!actionsContainer) return;

        actionsContainer.replaceChildren();

        const settingsButton = document.createElement('button');
        settingsButton.type = 'button';
        settingsButton.className = 'settings-btn bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded text-sm';
        settingsButton.dataset.accountId = String(account.id);
        settingsButton.textContent = 'Settings';

        actionsContainer.appendChild(settingsButton);

        const action = account.status === 'disconnected'
            ? createActionForm(`/dashboard/accounts/connect/${account.id}`, account.id, 'Connect', 'bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm')
            : createActionForm(`/dashboard/accounts/disconnect/${account.id}`, account.id, 'Disconnect', 'bg-orange-500 hover:bg-orange-600 text-white py-1 px-3 rounded text-sm');

        actionsContainer.appendChild(action);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-btn bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm';
        deleteButton.dataset.accountId = String(account.id);
        deleteButton.dataset.accountName = account.name;
        deleteButton.textContent = 'Delete';

        actionsContainer.appendChild(deleteButton);
    };

    const updateHiddenMimeTypes = () => {
        const selected = Array.from(document.querySelectorAll('.mimeType-checkbox:checked')).map((checkbox) => checkbox.value);
        mimeTypeInput.value = selected.join(',');
    };

    const renderMimeTypeCheckboxes = (selectedMimeTypes = []) => {
        const container = document.getElementById('mimeTypeOptions');
        if (!container) return;

        container.replaceChildren();

        mimeTypeList.forEach((mimeType, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-center mb-2';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `mimetype-${index}`;
            checkbox.value = mimeType.value;
            checkbox.className = 'mimeType-checkbox h-4 w-4 text-blue-600 rounded';
            checkbox.checked = selectedMimeTypes.includes(mimeType.value);
            checkbox.addEventListener('change', updateHiddenMimeTypes);

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.className = 'ml-2 text-sm text-gray-700';
            label.textContent = mimeType.label;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            container.appendChild(wrapper);
        });

        updateHiddenMimeTypes();
    };

    const openDeleteModal = (accountId, accountName) => {
        deleteAccountName.textContent = accountName;
        deleteForm.action = `/dashboard/accounts/delete/${accountId}`;
        deleteModal.classList.remove('hidden');
    };

    const openSettingsModal = async (accountId) => {
        const account = accountsData.get(accountId);
        if (!account) return;

        settingsForm.action = `/dashboard/accounts/settings/${accountId}`;
        webhookUrlInput.value = '';
        apiKeyInput.value = '';
        document.getElementById('modal-account-name').textContent = account.name;
        mediaSettingsContainer.style.display = account.allowMedia ? 'block' : 'none';
        document.getElementById('maxFileSize').value = account.maxFileSize || '';
        renderMimeTypeCheckboxes(account.allowedMimeTypes || []);
        modal.classList.remove('hidden');

        try {
            const response = await fetch(`/dashboard/accounts/${accountId}/settings`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Gagal mengambil pengaturan akun.');
            }

            const settings = await response.json();
            webhookUrlInput.value = settings.webhookUrl || '';
            apiKeyInput.value = settings.apiKey || '';
            document.getElementById('maxFileSize').value = settings.maxFileSize || '';
            renderMimeTypeCheckboxes(settings.allowedMimeTypes || []);
        } catch (error) {
            console.error(error);
        }
    };

    const createMessageCell = (text, className) => {
        const cell = document.createElement('td');
        cell.className = className;
        cell.textContent = text;
        return cell;
    };

    const renderMessages = () => {
        const selectedAccountId = accountFilter.value;
        const filteredMessages = currentMessages.filter((message) => selectedAccountId === 'all' || String(message.accountId) === selectedAccountId);

        messageLogBody.replaceChildren();

        filteredMessages.forEach((message) => {
            const row = document.createElement('tr');

            const directionCell = document.createElement('td');
            directionCell.className = 'px-6 py-4 whitespace-nowrap';
            const directionBadge = document.createElement('span');
            directionBadge.className = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${message.direction === 'incoming' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`;
            directionBadge.textContent = (message.direction || '').substring(0, 3).toUpperCase();
            directionCell.appendChild(directionBadge);

            const content = message.content
                ? String(message.content).slice(0, 50) + (String(message.content).length > 50 ? '...' : '')
                : '[Media]';

            const mediaCell = document.createElement('td');
            mediaCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
            if (message.mediaUrl) {
                try {
                    const mediaUrl = new URL(message.mediaUrl, window.location.origin);
                    if (['http:', 'https:'].includes(mediaUrl.protocol)) {
                        const link = document.createElement('a');
                        link.href = mediaUrl.toString();
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'text-blue-500 hover:underline';
                        link.textContent = 'View';
                        mediaCell.appendChild(link);
                    } else {
                        mediaCell.textContent = '-';
                    }
                } catch (error) {
                    mediaCell.textContent = '-';
                }
            } else {
                mediaCell.textContent = '-';
            }

            row.appendChild(directionCell);
            row.appendChild(createMessageCell(message.direction === 'incoming' ? (message.from || '') : (message.to || ''), 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'));
            row.appendChild(createMessageCell(content, 'px-6 py-4 text-sm text-gray-500'));
            row.appendChild(mediaCell);
            row.appendChild(createMessageCell(new Date(message.timestamp).toLocaleString(), 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'));

            messageLogBody.appendChild(row);
        });
    };

    const fetchMessages = async (accountId = 'all') => {
        try {
            const response = await fetch(`/api/messages/${accountId}`, { credentials: 'same-origin' });
            if (!response.ok) return;
            currentMessages = await response.json();
            renderMessages();
        } catch (error) {
            console.error('Gagal mengambil log pesan:', error);
        }
    };

    document.body.addEventListener('click', async (event) => {
        const settingsButton = event.target.closest('.settings-btn');
        if (settingsButton) {
            await openSettingsModal(Number(settingsButton.dataset.accountId));
            return;
        }

        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            openDeleteModal(deleteButton.dataset.accountId, deleteButton.dataset.accountName);
        }
    });

    cancelDeleteBtn?.addEventListener('click', () => deleteModal.classList.add('hidden'));
    document.getElementById('close-modal-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
    accountFilter?.addEventListener('change', () => renderMessages());

    document.getElementById('generate-api-key-btn')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/dashboard/generate-api-key', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('Gagal menghasilkan API key.');
            }
            const data = await response.json();
            apiKeyInput.value = data.apiKey || '';
        } catch (error) {
            console.error(error);
        }
    });

    fetch('/api/mime-types', { credentials: 'same-origin' })
        .then((response) => response.json())
        .then((data) => {
            mimeTypeList = data;
            renderMimeTypeCheckboxes();
        })
        .catch((error) => console.error('Gagal mengambil daftar tipe MIME:', error));

    accountsData.forEach(renderAccountActions);

    socket.on('status-change', (data) => {
        const account = accountsData.get(data.accountId);
        if (!account) return;

        account.status = data.status;
        const accountDiv = document.getElementById(`account-${data.accountId}`);
        if (!accountDiv) return;

        const statusSpan = accountDiv.querySelector('.status-span');
        statusSpan.textContent = data.status;
        setStatusClass(statusSpan, data.status);
        renderAccountActions(account);

        if (data.status !== 'qr-code') {
            accountDiv.querySelector('.qr-code-container')?.classList.add('hidden');
        }
    });

    socket.on('qr-code', (data) => {
        const accountDiv = document.getElementById(`account-${data.accountId}`);
        if (!accountDiv) return;

        const qrContainer = accountDiv.querySelector('.qr-code-container');
        const image = qrContainer?.querySelector('img');
        if (qrContainer && image) {
            image.src = data.qrCode;
            qrContainer.classList.remove('hidden');
        }
    });

    socket.on('new-message', (message) => {
        currentMessages.unshift(message);
        renderMessages();
    });

    fetchMessages();
});
