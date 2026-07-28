/**
 * Read-only dashboard projections. Counts are always derived from canonical
 * employee/candidate/movement/document rows; no UI total is persisted.
 *
 * Public API:
 *   HrDashboardService.getOverview(query)
 *   HrDashboardService.getCounts(query)
 *   HrDashboardService.getRecent(query)
 */
var HrDashboardService = (function () {
  'use strict';

  function fail_(code, message, details) {
    if (typeof HrCore !== 'undefined' && typeof HrCore.error === 'function') {
      throw HrCore.error(code, message, details || null);
    }
    var error = new Error(message);
    error.code = code;
    error.details = details || null;
    throw error;
  }

  function assert_(condition, code, message, details) {
    if (!condition) fail_(code, message, details);
  }

  function bootstrap_() {
    HrSheetStore.bootstrap();
  }

  function rows_(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function all_(table) {
    return table ? rows_(HrSheetStore.list(table)) : [];
  }

  function trim_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function today_() {
    return Utilities.formatDate(
      new Date(),
      HrConfig.get('TIME_ZONE', 'Asia/Ho_Chi_Minh'),
      'yyyy-MM-dd'
    );
  }

  function validDate_(value, field) {
    var text = trim_(value);
    assert_(/^\d{4}-\d{2}-\d{2}$/.test(text),
      'DASHBOARD_DATE_INVALID',
      'Ngày dashboard phải có định dạng yyyy-MM-dd.',
      { field: field });
    var parsed = new Date(text + 'T00:00:00Z');
    assert_(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text,
      'DASHBOARD_DATE_INVALID',
      'Ngày dashboard không hợp lệ.',
      { field: field });
    return text;
  }

  function period_(query) {
    query = query || {};
    if (query.from_date || query.to_date) {
      var from = validDate_(query.from_date || query.to_date, 'from_date');
      var to = validDate_(query.to_date || query.from_date, 'to_date');
      assert_(to >= from, 'DASHBOARD_DATE_RANGE_INVALID', 'Khoảng ngày dashboard không hợp lệ.');
      return { from: from, to: to, key: from + ':' + to };
    }
    var month = trim_(query.month);
    if (!month) {
      var asOf = validDate_(query.as_of_date || today_(), 'as_of_date');
      month = asOf.slice(0, 7);
    }
    assert_(/^\d{4}-\d{2}$/.test(month),
      'DASHBOARD_MONTH_INVALID',
      'Tháng dashboard phải có định dạng yyyy-MM.');
    var start = month + '-01';
    var cursor = new Date(start + 'T00:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    cursor.setUTCDate(0);
    var end = cursor.toISOString().slice(0, 10);
    return { from: start, to: end, key: month };
  }

  function activeRows_(table) {
    return all_(table).filter(function (row) {
      return row.record_status !== 'DELETED';
    });
  }

  function employeeMap_(employees) {
    var result = {};
    employees.forEach(function (employee) { result[employee.employee_id] = employee; });
    return result;
  }

  function countBy_(items, field, allowed) {
    var result = {};
    (allowed || []).forEach(function (value) { result[value] = 0; });
    items.forEach(function (item) {
      var key = item[field] || 'UNKNOWN';
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }

  function selectDepartment_(row, employeeById, departmentId) {
    if (!departmentId) return true;
    if (row.department_id !== undefined) return row.department_id === departmentId;
    var employee = employeeById[row.employee_id];
    return employee && employee.department_id === departmentId;
  }

  function build_(query) {
    bootstrap_();
    query = query || {};
    var period = period_(query);
    var asOfDate = validDate_(query.as_of_date || today_(), 'as_of_date');
    var departmentId = trim_(query.department_id);
    var employees = activeRows_(HrSchema.TABLES.EMPLOYEES).filter(function (row) {
      return !departmentId || row.department_id === departmentId;
    });
    var employeeById = employeeMap_(employees);
    var movements = activeRows_(HrSchema.TABLES.WORKFORCE_MOVEMENTS).filter(function (row) {
      return row.movement_status === 'CONFIRMED' &&
        row.effective_date >= period.from &&
        row.effective_date <= period.to &&
        selectDepartment_(row, employeeById, departmentId);
    });
    var candidates = activeRows_(HrSchema.TABLES.PROBATION_CANDIDATES).filter(function (row) {
      return !departmentId || row.department_id === departmentId;
    });
    var documents = activeRows_(HrSchema.TABLES.GENERATED_DOCUMENTS).filter(function (row) {
      if (!row.generated_at || row.generated_at.slice(0, 10) < period.from ||
          row.generated_at.slice(0, 10) > period.to) return false;
      if (!departmentId) return true;
      var candidate = candidates.filter(function (item) {
        return item.candidate_id === row.candidate_id;
      })[0];
      return !!candidate;
    });

    var employeeCounts = countBy_(employees, 'employment_status', ['DRAFT', 'ACTIVE', 'INACTIVE']);
    var movementCounts = countBy_(movements, 'movement_type', ['INCREASE', 'DECREASE']);
    var probationCounts = countBy_(
      candidates,
      'candidate_status',
      ['DRAFT', 'CONTRACT_CREATED', 'IN_PROBATION', 'PASSED', 'FAILED', 'CONVERTED', 'CANCELLED']
    );
    var documentCounts = countBy_(
      documents,
      'generation_status',
      ['PROCESSING', 'PREVIEW', 'GENERATED', 'SUPERSEDED', 'VOIDED', 'FAILED']
    );
    var roster = HrWorkforceService.liveRoster(asOfDate, {
      department_id: departmentId || null,
      page: 1,
      pageSize: 1
    });

    return {
      period: period,
      as_of_date: asOfDate,
      department_id: departmentId || null,
      employees: employees,
      employeeById: employeeById,
      movements: movements,
      candidates: candidates,
      documents: documents,
      counts: {
        employees: {
          total: employees.length,
          draft: employeeCounts.DRAFT || 0,
          active_current_master: employeeCounts.ACTIVE || 0,
          active_as_of: roster.active_count || 0,
          inactive: employeeCounts.INACTIVE || 0
        },
        movements: {
          increase: movementCounts.INCREASE || 0,
          decrease: movementCounts.DECREASE || 0,
          net: (movementCounts.INCREASE || 0) - (movementCounts.DECREASE || 0),
          confirmed_total: movements.length
        },
        probation: {
          total: candidates.length,
          active: (probationCounts.DRAFT || 0) +
            (probationCounts.CONTRACT_CREATED || 0) +
            (probationCounts.IN_PROBATION || 0),
          draft: probationCounts.DRAFT || 0,
          contract_created: probationCounts.CONTRACT_CREATED || 0,
          in_probation: probationCounts.IN_PROBATION || 0,
          passed: probationCounts.PASSED || 0,
          failed: probationCounts.FAILED || 0,
          converted: probationCounts.CONVERTED || 0,
          cancelled: probationCounts.CANCELLED || 0
        },
        documents: {
          generated: documentCounts.GENERATED || 0,
          failed: documentCounts.FAILED || 0,
          processing: documentCounts.PROCESSING || 0,
          total: documents.length
        }
      }
    };
  }

  function getCounts(query) {
    var data = build_(query);
    return {
      period: data.period,
      as_of_date: data.as_of_date,
      department_id: data.department_id,
      employees: data.counts.employees,
      movements: data.counts.movements,
      probation: data.counts.probation,
      documents: data.counts.documents
    };
  }

  function getRecent(query) {
    query = query || {};
    var data = build_(query);
    var limit = Math.min(Math.max(Number(query.recentLimit || query.limit || 5), 1), 20);

    var recentEmployees = data.employees.slice().sort(function (left, right) {
      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    }).slice(0, limit).map(function (row) {
      return {
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        full_name: row.full_name,
        employment_status: row.employment_status,
        department_id: row.department_id || null,
        position_id: row.position_id || null,
        hire_date: row.hire_date || null,
        created_at: row.created_at || null
      };
    });

    var recentMovements = data.movements.slice().sort(function (left, right) {
      var effectiveOrder = String(right.effective_date || '').localeCompare(String(left.effective_date || ''));
      return effectiveOrder || String(right.confirmed_at || '').localeCompare(String(left.confirmed_at || ''));
    }).slice(0, limit).map(function (row) {
      var employee = data.employeeById[row.employee_id] || {};
      return {
        movement_id: row.movement_id,
        movement_type: row.movement_type,
        effective_date: row.effective_date,
        employee_id: row.employee_id,
        employee_code: employee.employee_code || null,
        employee_name: employee.full_name || null
      };
    });

    var recentCandidates = data.candidates.slice().sort(function (left, right) {
      return String(right.updated_at || right.created_at || '').localeCompare(
        String(left.updated_at || left.created_at || '')
      );
    }).slice(0, limit).map(function (row) {
      return {
        candidate_id: row.candidate_id,
        candidate_code: row.candidate_code,
        full_name: row.full_name,
        candidate_status: row.candidate_status,
        department_id: row.department_id || null,
        updated_at: row.updated_at || null
      };
    });

    var recentDocuments = data.documents.slice().sort(function (left, right) {
      return String(right.generated_at || '').localeCompare(String(left.generated_at || ''));
    }).slice(0, limit).map(function (row) {
      return {
        generated_document_id: row.generated_document_id,
        document_type: row.document_type,
        candidate_id: row.candidate_id || null,
        contract_no: row.contract_no || null,
        contract_year: row.contract_year || null,
        generation_status: row.generation_status,
        generated_at: row.generated_at || null
      };
    });

    return {
      recent_employees: recentEmployees,
      recent_movements: recentMovements,
      recent_candidates: recentCandidates,
      recent_documents: recentDocuments
    };
  }

  function getOverview(query) {
    var counts = getCounts(query);
    var recent = getRecent(query);
    return {
      period: counts.period,
      as_of_date: counts.as_of_date,
      department_id: counts.department_id,
      counts: {
        employees: counts.employees,
        movements: counts.movements,
        probation: counts.probation,
        documents: counts.documents
      },
      recent: recent,

      // Compatibility projection for the current four-card Apps Script UI.
      totalEmployees: counts.employees.total,
      activeEmployees: counts.employees.active_as_of,
      probationCandidates: counts.probation.active,
      newHires: counts.movements.increase,
      departures: counts.movements.decrease,
      netMovement: counts.movements.net
    };
  }

  return Object.freeze({
    getOverview: getOverview,
    getCounts: getCounts,
    getRecent: getRecent
  });
})();
