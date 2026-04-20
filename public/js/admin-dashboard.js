document.addEventListener('DOMContentLoaded', () => {
    const userFilter = document.getElementById('user-filter');
    const statusFilter = document.getElementById('status-filter');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deleteForm = document.getElementById('delete-form');
    const deleteAccountName = document.getElementById('delete-account-name');

    const applyFilters = () => {
        const query = new URLSearchParams({
            user: userFilter.value,
            status: statusFilter.value,
        });

        window.location.search = query.toString();
    };

    const openDeleteModal = (accountId, accountName) => {
        deleteAccountName.textContent = accountName;
        const url = new URL(`${window.location.origin}/admin/accounts/delete/${accountId}`);
        url.search = window.location.search;
        deleteForm.action = url.toString();
        deleteModal.classList.remove('hidden');
    };

    userFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);

    document.querySelectorAll('.toggle-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', function handleToggle() {
            const form = this.closest('form');
            const url = new URL(form.action);
            url.search = window.location.search;
            form.action = url.toString();
            form.submit();
        });
    });

    cancelDeleteBtn?.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });

    document.body.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('.delete-btn');
        if (!deleteButton) return;
        openDeleteModal(deleteButton.dataset.accountId, deleteButton.dataset.accountName);
    });
});
