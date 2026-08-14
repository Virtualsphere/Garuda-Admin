import { useState, useEffect } from 'react';
import employeeService from '../services/employeeService';

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const startOfDay = (dateStr) => {
  const d = parseLocalDate(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (dateStr) => {
  const d = parseLocalDate(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function useFieldExecutiveFilter() {
  const [executives, setExecutives] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [executiveId, setExecutiveId] = useState('');

  useEffect(() => {
    const fetchExecutives = async () => {
      try {
        const data = await employeeService.getAll();
        const empList = data.data || data.employees || data || [];
        setExecutives(Array.isArray(empList) ? empList : []);
      } catch (err) {
        console.error('Failed to fetch field executives:', err);
      }
    };
    fetchExecutives();
  }, []);

  const matchesFilters = (land) => {
    if (executiveId && String(land.created_by) !== String(executiveId)) return false;
    if (dateFrom || dateTo) {
      if (!land.created_at) return false;
      const created = new Date(land.created_at);
      if (dateFrom && created < startOfDay(dateFrom)) return false;
      if (dateTo && created > endOfDay(dateTo)) return false;
    }
    return true;
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setExecutiveId('');
  };

  return {
    executives,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    executiveId, setExecutiveId,
    matchesFilters,
    hasActiveFilters: Boolean(dateFrom || dateTo || executiveId),
    resetFilters,
  };
}
