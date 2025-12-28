import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addEmployee, updateEmployee, getAllEmployees, getEmployeeById, type AddEmployeeParams, type UpdateEmployeeParams, type LaundryEmployee } from '../services/firestoreService';

export default function AddEditEmployeePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeId = searchParams.get('id');
  const isEditMode = !!employeeId;

  const [employees, setEmployees] = useState<LaundryEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    isAdmin: false,
    password: '',
    confirmPassword: '',
  });

  // Load employees list and current employee if editing
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allEmployees = await getAllEmployees();
        setEmployees(allEmployees);

        if (isEditMode && employeeId) {
          const employee = await getEmployeeById(employeeId);
          if (employee) {
            setFormData({
              username: employee.username,
              name: employee.name,
              isAdmin: employee.isAdmin,
              password: '', // Don't load password
              confirmPassword: '',
            });
          } else {
            setMessage('❌ Employee not found.');
            setTimeout(() => navigate('/override'), 2000);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setMessage(`❌ Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [employeeId, isEditMode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username.trim() || !formData.name.trim()) {
      setMessage('⚠️ Username and name are required.');
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (isEditMode) {
      // For edit mode, password is optional
      if (formData.password && formData.password !== formData.confirmPassword) {
        setMessage('⚠️ Passwords do not match.');
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    } else {
      // For add mode, password is required
      if (!formData.password || formData.password !== formData.confirmPassword) {
        setMessage('⚠️ Password is required and must match confirmation.');
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      if (isEditMode && employeeId) {
        const updateParams: UpdateEmployeeParams = {
          id: employeeId,
          username: formData.username,
          name: formData.name,
          isAdmin: formData.isAdmin,
        };

        // Only update password if provided
        if (formData.password.trim()) {
          updateParams.password = formData.password;
        }

        await updateEmployee(updateParams);
        setMessage('✅ Employee updated successfully!');
        setTimeout(() => navigate('/override'), 2000);
      } else {
        const addParams: AddEmployeeParams = {
          username: formData.username,
          name: formData.name,
          isAdmin: formData.isAdmin,
          password: formData.password,
        };

        await addEmployee(addParams);
        setMessage('✅ Employee added successfully!');
        
        // Reset form for adding another
        setFormData({
          username: '',
          name: '',
          isAdmin: false,
          password: '',
          confirmPassword: '',
        });
        
        // Reload employees list
        const allEmployees = await getAllEmployees();
        setEmployees(allEmployees);
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="override-back-container">
        <button 
          className="btn-back" 
          onClick={() => navigate('/override')}
          title="Back to Override Control"
        >
          ← Back
        </button>
      </div>

      <div className="override-header">
        <h2>{isEditMode ? 'Edit Employee' : 'Add Employee'}</h2>
        <p className="override-description">
          {isEditMode 
            ? 'Update employee information. Leave password fields empty to keep the current password.'
            : 'Add a new employee to the system. The employee ID will be automatically generated.'}
        </p>
      </div>

      <div className="employee-management-container">
        <form onSubmit={handleSubmit} className="employee-form-page">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Enter username"
              disabled={saving}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter employee name"
              disabled={saving}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="isAdmin" className="checkbox-label">
              <input
                id="isAdmin"
                type="checkbox"
                checked={formData.isAdmin}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                disabled={saving}
              />
              <span>Admin</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password {isEditMode ? '(leave empty to keep current)' : '*'}
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={isEditMode ? 'Enter new password (optional)' : 'Enter password'}
              disabled={saving}
              required={!isEditMode}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password {isEditMode ? '(leave empty to keep current)' : '*'}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder={isEditMode ? 'Confirm new password (optional)' : 'Confirm password'}
              disabled={saving}
              required={!isEditMode}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/override')}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !formData.username.trim() || !formData.name.trim() || (!isEditMode && !formData.password.trim())}
            >
              {saving ? (
                <>
                  <div className="spinner-small" />
                  <span>{isEditMode ? 'Updating...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Employee' : 'Add Employee'}</span>
              )}
            </button>
          </div>

          {message && (
            <div className={`control-message ${message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : 'info'}`}>
              {message}
            </div>
          )}
        </form>

        {employees.length > 0 && (
          <div className="employees-list">
            <h3>Existing Employees</h3>
            <div className="employees-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Admin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.id}</td>
                      <td>{employee.username}</td>
                      <td>{employee.name}</td>
                      <td>{employee.isAdmin ? 'Yes' : 'No'}</td>
                      <td>
                        <button
                          className="btn-edit"
                          onClick={() => navigate(`/override/add-edit-employee?id=${employee.id}`)}
                          disabled={saving}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

