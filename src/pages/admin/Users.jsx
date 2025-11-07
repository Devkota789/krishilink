import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import AdminSidebar from "../../components/AdminSidebar";
import { userAPI } from "../../api/api";
import "./Users.css";

const tabs = [
  { key: "all", label: "All Users", implemented: true },
  { key: "farmers", label: "Farmers", implemented: true },
  { key: "buyers", label: "Buyers", implemented: true },
  { key: "active", label: "Active Users", implemented: true },
  { key: "blocked", label: "Blocked Users", implemented: true },
  { key: "locked", label: "Locked Users", implemented: true },
];

const headerTitle = (category) => {
  switch (category) {
    case "farmers":
      return "Farmers Management";
    case "buyers":
      return "Buyers Management";
    case "active":
      return "Active Users";
    case "blocked":
      return "Blocked Users";
    case "locked":
      return "Locked Users";
    default:
      return "All Users";
  }
};

const Users = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("fullName");
  const [sortDir, setSortDir] = useState("asc");

  // Advanced controls state
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(null);

  const [openRowMenuId, setOpenRowMenuId] = useState(null);
  const menuRef = useRef(null);

  // Modals for actions
  const [lockModal, setLockModal] = useState({ open: false, userId: null });
  const [resetPwModal, setResetPwModal] = useState({
    open: false,
    userId: null,
  });

  const defaultColumns = useMemo(
    () => [
      { key: "select", label: "", sortable: false, visible: true },
      { key: "id", label: "ID", sortable: true, visible: true },
      { key: "fullName", label: "Full Name", sortable: true, visible: true },
      { key: "email", label: "Email", sortable: false, visible: true },
      { key: "phone", label: "Phone", sortable: false, visible: true },
      { key: "role", label: "Role", sortable: true, visible: true },
      { key: "address", label: "Address", sortable: false, visible: true },
      { key: "createdAt", label: "Created", sortable: true, visible: false },
      { key: "lastLogin", label: "Last Login", sortable: true, visible: false },
      { key: "orders", label: "Orders", sortable: true, visible: false },
      { key: "payments", label: "Payments", sortable: true, visible: false },
      { key: "actions", label: "Actions", sortable: false, visible: true },
    ],
    []
  );
  const [columns, setColumns] = useState(defaultColumns);

  // Build per-tab column configurations
  const buildColumns = (cat) => {
    if (cat === "farmers") {
      return [
        { key: "select", label: "", sortable: false, visible: true },
        { key: "id", label: "ID", sortable: true, visible: true },
        { key: "fullName", label: "Full Name", sortable: true, visible: true },
        { key: "phone", label: "Phone", sortable: false, visible: true },
        { key: "email", label: "Email", sortable: false, visible: true },
        { key: "role", label: "Role", sortable: false, visible: true },
        { key: "address", label: "Address", sortable: false, visible: true },
        {
          key: "reputation",
          label: "Reputation",
          sortable: false,
          visible: true,
        },
        {
          key: "totalProducts",
          label: "Total Products",
          sortable: false,
          visible: true,
        },
        {
          key: "totalProductsSold",
          label: "Products Sold",
          sortable: false,
          visible: true,
        },
        { key: "createdAt", label: "Created", sortable: false, visible: false },
        {
          key: "lastLogin",
          label: "Last Login",
          sortable: false,
          visible: false,
        },
        // No actions here
      ];
    }
    if (cat === "buyers") {
      return [
        { key: "select", label: "", sortable: false, visible: true },
        { key: "id", label: "ID", sortable: true, visible: true },
        { key: "fullName", label: "Full Name", sortable: true, visible: true },
        { key: "phone", label: "Phone", sortable: false, visible: true },
        { key: "email", label: "Email", sortable: false, visible: true },
        { key: "address", label: "Address", sortable: false, visible: true },
        { key: "orders", label: "Orders", sortable: false, visible: true },
        {
          key: "totalMoneySpend",
          label: "Money Spent",
          sortable: false,
          visible: true,
        },
        { key: "createdAt", label: "Created", sortable: false, visible: false },
        {
          key: "lastLogin",
          label: "Last Login",
          sortable: false,
          visible: false,
        },
      ];
    }
    if (cat === "active") {
      return [
        { key: "select", label: "", sortable: false, visible: true },
        { key: "id", label: "ID", sortable: true, visible: true },
        { key: "fullName", label: "Full Name", sortable: true, visible: true },
        { key: "phone", label: "Phone", sortable: false, visible: true },
        { key: "email", label: "Email", sortable: false, visible: true },
        { key: "role", label: "Role", sortable: false, visible: true },
        { key: "isActive", label: "Status", sortable: false, visible: true },
        {
          key: "lastLogin",
          label: "Last Login",
          sortable: false,
          visible: true,
        },
        { key: "address", label: "Address", sortable: false, visible: false },
      ];
    }
    if (cat === "blocked" || cat === "locked") {
      // Keep actions (with inline Unblock/Unlock behavior already handled)
      return [
        { key: "select", label: "", sortable: false, visible: true },
        { key: "id", label: "ID", sortable: true, visible: true },
        { key: "fullName", label: "Full Name", sortable: true, visible: true },
        { key: "email", label: "Email", sortable: false, visible: true },
        { key: "phone", label: "Phone", sortable: false, visible: true },
        { key: "role", label: "Role", sortable: true, visible: true },
        { key: "address", label: "Address", sortable: false, visible: true },
        { key: "createdAt", label: "Created", sortable: true, visible: false },
        {
          key: "lastLogin",
          label: "Last Login",
          sortable: true,
          visible: false,
        },
        { key: "actions", label: "Actions", sortable: false, visible: true },
      ];
    }
    // Default (All Users): keep full set with actions
    return [...defaultColumns];
  };

  // Update visible columns when tab changes
  useEffect(() => {
    setColumns(buildColumns(category));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const fetchData = async (selected) => {
    setLoading(true);
    setError("");
    try {
      let result;
      switch (selected) {
        case "farmers":
          result = await userAPI.getAllFarmers();
          break;
        case "buyers":
          result = await userAPI.getAllBuyers();
          break;
        case "active":
          result = await userAPI.getAllActiveUsers();
          break;
        case "blocked":
          result = await userAPI.getAllBlockedUsers();
          break;
        case "locked":
          result = await userAPI.getAllLockedUsers();
          break;
        default:
          result = await userAPI.getAllUsers();
      }
      if (result?.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        // Normalize server variations so the table always has a role field
        const normalized = list.map((u) => {
          // Prefer explicit string role fields; fall back to common variants
          let role = undefined;
          const candidates = [
            u?.role,
            u?.Role,
            u?.roleName,
            u?.RoleName,
            u?.userType,
            u?.UserType,
          ].filter((v) => typeof v === "string" && v.trim().length > 0);
          if (candidates.length) {
            role = String(candidates[0]).trim();
          } else if (Array.isArray(u?.roles) && u.roles.length) {
            role = u.roles.join(", ");
          } else if (u?.isAdmin) {
            role = "admin";
          } else if (u?.isFarmer) {
            role = "farmer";
          } else if (u?.isBuyer) {
            role = "buyer";
          }
          return {
            ...u,
            // Ensure a consistent string (e.g., "Farmer", "Buyer", "Admin")
            role: role,
          };
        });
        setUsers(normalized);
      } else {
        setError(result?.error || "Failed to load users");
        setUsers([]);
      }
    } catch (e) {
      setError(e?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(category);
    setPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Close row menu on outside click or Escape
  useEffect(() => {
    if (!openRowMenuId) return;
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpenRowMenuId(null);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenRowMenuId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openRowMenuId]);

  useEffect(() => {
    if (!autoRefresh) {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      return;
    }
    autoRefreshRef.current = setInterval(() => {
      fetchData(category);
    }, 15000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = users;
    if (roleFilter !== "all") {
      base = base.filter((u) => (u.role || "").toLowerCase() === roleFilter);
    }
    if (statusFilter !== "all") {
      base = base.filter((u) => {
        const isActive = typeof u.isActive === "boolean" ? u.isActive : null;
        const blocked = !!u.isBlocked;
        const locked = !!u.isLocked;
        if (statusFilter === "active") return isActive === true;
        if (statusFilter === "inactive") return isActive === false;
        if (statusFilter === "blocked") return blocked;
        if (statusFilter === "locked") return locked;
        return true;
      });
    }
    if (dateFrom) {
      const from = Date.parse(dateFrom);
      if (!isNaN(from)) {
        base = base.filter((u) => {
          const created = Date.parse(u.createdAt);
          return isNaN(created) ? true : created >= from;
        });
      }
    }
    if (dateTo) {
      const to = Date.parse(dateTo);
      if (!isNaN(to)) {
        base = base.filter((u) => {
          const created = Date.parse(u.createdAt);
          return isNaN(created) ? true : created <= to + 86400000 - 1;
        });
      }
    }
    if (!q) return base;
    return base.filter((u) => {
      const name = (u.fullName || u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phoneNumber || u.phone || "").toLowerCase();
      const role = (u.role || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        role.includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a?.[sortKey] ?? "").toString().toLowerCase();
      const bv = (b?.[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const refresh = () => fetchData(category);

  // Row menu helpers
  const toggleRowMenu = (userId) => {
    setOpenRowMenuId((cur) => (cur === userId ? null : userId));
  };
  const closeRowMenu = () => setOpenRowMenuId(null);

  // Action handlers
  const handleBlock = async (userId) => {
    try {
      const res = await userAPI.blockUser(userId);
      if (res?.success) {
        alert("User blocked");
        refresh();
      } else {
        alert(res?.error || "Failed to block user");
      }
    } catch (e) {
      alert(e?.message || "Failed to block user");
    } finally {
      closeRowMenu();
    }
  };
  const handleUnblock = async (userId) => {
    try {
      const res = await userAPI.unblockUser(userId);
      if (res?.success) {
        alert("User unblocked");
        refresh();
      } else {
        alert(res?.error || "Failed to unblock user");
      }
    } catch (e) {
      alert(e?.message || "Failed to unblock user");
    } finally {
      closeRowMenu();
    }
  };
  const confirmAndUnblock = (userId) => {
    const ok = window.confirm("Unblock this user?");
    if (ok) handleUnblock(userId);
  };
  const openLockModal = (userId) => {
    setLockModal({ open: true, userId });
    closeRowMenu();
  };
  const openResetPwModal = (userId) => {
    setResetPwModal({ open: true, userId });
    closeRowMenu();
  };
  const handleUnlock = async (userId) => {
    try {
      const res = await userAPI.unlockUser(userId);
      if (res?.success) {
        alert("User unlocked");
        refresh();
      } else {
        alert(res?.error || "Failed to unlock user");
      }
    } catch (e) {
      alert(e?.message || "Failed to unlock user");
    } finally {
      closeRowMenu();
    }
  };
  const confirmAndUnlock = (userId) => {
    const ok = window.confirm("Unlock this user?");
    if (ok) handleUnlock(userId);
  };

  const exportCsv = () => {
    const headers = [
      "Id",
      "Full Name",
      "Email",
      "Phone",
      "Role",
      "Status",
      "Address",
    ];
    const rows = sorted.map((u) => [
      u.id ?? "",
      u.fullName ?? u.name ?? "",
      u.email ?? "",
      u.phoneNumber ?? u.phone ?? "",
      u.role ?? "",
      typeof u.isActive === "boolean"
        ? u.isActive
          ? "Active"
          : "Inactive"
        : u.status ?? "",
      u.address ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${category}-users.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyEmails = async () => {
    const emails = sorted
      .map((u) => u.email)
      .filter(Boolean)
      .join(", ");
    if (!emails) return;
    try {
      await navigator.clipboard.writeText(emails);
      alert("Emails copied to clipboard");
    } catch {
      alert("Failed to copy");
    }
  };

  const allSelectedOnPage =
    pageItems.length && pageItems.every((u) => selectedIds.has(u.id));
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allSelectedOnPage) {
      pageItems.forEach((u) => next.delete(u.id));
    } else {
      pageItems.forEach((u) => next.add(u.id));
    }
    setSelectedIds(next);
  };
  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const clearSelections = () => setSelectedIds(new Set());

  const bulkAction = (action) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (action === "delete") {
      const ok = window.confirm(`Delete ${ids.length} selected user(s)?`);
      if (!ok) return;
      Promise.allSettled(ids.map((id) => userAPI.deleteUser(id)))
        .then(() => refresh())
        .finally(() => clearSelections());
      return;
    }
    if (action === "export") {
      const selected = sorted.filter((u) => selectedIds.has(u.id));
      const headers = [
        "Id",
        "Full Name",
        "Email",
        "Phone",
        "Role",
        "Status",
        "Address",
      ];
      const rows = selected.map((u) => [
        u.id ?? "",
        u.fullName ?? u.name ?? "",
        u.email ?? "",
        u.phoneNumber ?? u.phone ?? "",
        u.role ?? "",
        typeof u.isActive === "boolean"
          ? u.isActive
            ? "Active"
            : "Inactive"
          : u.status ?? "",
        u.address ?? "",
      ]);
      const csv = [headers, ...rows]
        .map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selected-users.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (action === "copyEmails") {
      const emails = sorted
        .filter((u) => selectedIds.has(u.id))
        .map((u) => u.email)
        .filter(Boolean)
        .join(", ");
      if (!emails) return;
      navigator.clipboard.writeText(emails).then(() => alert("Emails copied"));
      return;
    }
    alert(`${action} (${ids.length} selected) — API will be wired later.`);
  };

  const openAddUser = () => {
    setEditUser(null);
    setShowAddEdit(true);
  };
  const openEditUser = (user) => {
    setEditUser(user);
    setShowAddEdit(true);
  };
  const closeAddEdit = () => setShowAddEdit(false);

  const onImportCsv = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      alert(`Imported ${lines.length - 1} rows (preview). API wiring pending.`);
    };
    reader.readAsText(file);
  };
  const importRef = useRef(null);

  const confirmAndDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm("Delete this user?");
    if (!ok) return;
    try {
      await userAPI.deleteUser(id);
      refresh();
    } catch (e) {
      alert("Delete failed");
    }
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Navbar />
      <main style={{ paddingTop: 90, paddingInline: 0, flex: 1 }}>
        <div className="dashboard-body-wrapper">
          <AdminSidebar hideHeader hideDefaultNav>
            <section className="sidebar-section" style={{ paddingTop: 0 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => tab.implemented && setCategory(tab.key)}
                  className={`sidebar-btn ${
                    category === tab.key ? "active" : ""
                  }`}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 8,
                    opacity: tab.implemented ? 1 : 0.6,
                    cursor: tab.implemented ? "pointer" : "not-allowed",
                  }}
                  disabled={!tab.implemented}
                  title={tab.implemented ? undefined : "Coming soon"}
                >
                  {tab.label}
                </button>
              ))}
            </section>
          </AdminSidebar>
          <section className="dashboard-content">
            <div className="users-header">
              <div>
                <h1 className="users-title">{headerTitle(category)}</h1>
                <div className="users-sub">{total} users</div>
              </div>
              <div className="users-header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowColumnPicker((s) => !s)}
                >
                  Columns
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={exportCsv}
                  disabled={!sorted.length}
                >
                  Export CSV
                </button>
                <button className="btn btn-primary" onClick={openAddUser}>
                  Add User
                </button>
              </div>
            </div>

            <div className="users-card users-toolbar">
              <input
                type="text"
                className="input"
                placeholder="Search name, email, phone"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                className="input"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All roles</option>
                <option value="farmer">Farmer</option>
                <option value="buyer">Buyer</option>
                <option value="admin">Admin</option>
              </select>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
                <option value="locked">Locked</option>
              </select>
              <input
                type="date"
                className="input"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
              <input
                type="date"
                className="input"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear
              </button>
              <div className="toolbar-spacer" />
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span className="switch-label">Auto-refresh</span>
              </label>
              <button className="btn" onClick={refresh} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
              <button
                className="btn"
                onClick={copyEmails}
                disabled={!sorted.length}
              >
                Copy Emails
              </button>
              <button
                className="btn"
                onClick={() => importRef.current?.click()}
              >
                Import CSV
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => onImportCsv(e.target.files?.[0])}
              />
              <select
                className="input"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>
            </div>

            {selectedIds.size > 0 && (
              <div className="users-card bulkbar">
                <div>
                  <strong>{selectedIds.size}</strong> selected
                </div>
                <div className="bulk-actions">
                  <button
                    className="btn"
                    onClick={() => bulkAction("activate")}
                  >
                    Activate
                  </button>
                  <button
                    className="btn"
                    onClick={() => bulkAction("deactivate")}
                  >
                    Deactivate
                  </button>
                  <button className="btn" onClick={() => bulkAction("block")}>
                    Block
                  </button>
                  <button className="btn" onClick={() => bulkAction("unblock")}>
                    Unblock
                  </button>
                  <button className="btn" onClick={() => bulkAction("lock")}>
                    Lock
                  </button>
                  <button className="btn" onClick={() => bulkAction("unlock")}>
                    Unlock
                  </button>
                  <button className="btn" onClick={() => bulkAction("export")}>
                    Export selected
                  </button>
                  <button
                    className="btn"
                    onClick={() => bulkAction("copyEmails")}
                  >
                    Copy emails
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => bulkAction("delete")}
                  >
                    Delete
                  </button>
                </div>
                <button className="btn btn-ghost" onClick={clearSelections}>
                  Clear
                </button>
              </div>
            )}

            <div className="users-card">
              {error && <div className="error-bar">{error}</div>}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {columns
                        .filter((c) => c.visible)
                        .map((c) => (
                          <Th
                            key={c.key}
                            onClick={
                              c.sortable ? () => onSort(c.key) : undefined
                            }
                            active={sortKey === c.key}
                            dir={sortDir}
                            style={
                              c.key === "actions"
                                ? { textAlign: "right" }
                                : undefined
                            }
                          >
                            {c.key === "select" ? (
                              <input
                                type="checkbox"
                                checked={allSelectedOnPage}
                                onChange={toggleSelectAll}
                              />
                            ) : (
                              c.label
                            )}
                          </Th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={columns.filter((c) => c.visible).length}
                          className="table-empty"
                        >
                          Loading users…
                        </td>
                      </tr>
                    ) : !sorted.length ? (
                      <tr>
                        <td
                          colSpan={columns.filter((c) => c.visible).length}
                          className="table-empty"
                        >
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((u) => (
                        <tr key={u.id}>
                          {columns
                            .filter((c) => c.visible)
                            .map((c) => {
                              if (c.key === "select")
                                return (
                                  <Td key={`${u.id}-select`}>
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(u.id)}
                                      onChange={() => toggleSelect(u.id)}
                                    />
                                  </Td>
                                );
                              if (c.key === "id")
                                return (
                                  <Td key={`${u.id}-id`}>{u.id ?? "-"}</Td>
                                );
                              if (c.key === "fullName")
                                return (
                                  <Td key={`${u.id}-name`}>
                                    {u.fullName ?? u.name ?? "-"}
                                  </Td>
                                );
                              if (c.key === "email")
                                return (
                                  <Td key={`${u.id}-email`}>
                                    {u.email ?? "-"}
                                  </Td>
                                );
                              if (c.key === "phone")
                                return (
                                  <Td key={`${u.id}-phone`}>
                                    {u.phoneNumber ?? u.phone ?? "-"}
                                  </Td>
                                );
                              if (c.key === "role")
                                return (
                                  <Td key={`${u.id}-role`}>{u.role ?? "-"}</Td>
                                );
                              if (c.key === "isActive") {
                                const isActive =
                                  typeof u.isActive === "boolean"
                                    ? u.isActive
                                    : null;
                                return (
                                  <Td key={`${u.id}-status`}>
                                    {isActive === null ? (
                                      <span>-</span>
                                    ) : (
                                      <span
                                        className={`badge ${
                                          isActive ? "ok" : "warn"
                                        }`}
                                      >
                                        {isActive ? "Active" : "Inactive"}
                                      </span>
                                    )}
                                  </Td>
                                );
                              }
                              if (c.key === "address")
                                return (
                                  <Td key={`${u.id}-addr`}>
                                    {u.address ?? "-"}
                                  </Td>
                                );
                              if (c.key === "createdAt")
                                return (
                                  <Td key={`${u.id}-created`}>
                                    {u.createdAt ?? "-"}
                                  </Td>
                                );
                              if (c.key === "lastLogin")
                                return (
                                  <Td key={`${u.id}-last`}>
                                    {u.lastLogin ?? "-"}
                                  </Td>
                                );
                              if (c.key === "orders")
                                return (
                                  <Td key={`${u.id}-orders`}>
                                    {u.orders ?? "-"}
                                  </Td>
                                );
                              if (c.key === "payments")
                                return (
                                  <Td key={`${u.id}-payments`}>
                                    {u.payments ?? "-"}
                                  </Td>
                                );
                              if (c.key === "reputation")
                                return (
                                  <Td key={`${u.id}-rep`}>
                                    {u.ReputationCount ??
                                      u.reputationCount ??
                                      "-"}
                                  </Td>
                                );
                              if (c.key === "reports")
                                return (
                                  <Td key={`${u.id}-reports`}>
                                    {u.ReportCount ?? u.reportCount ?? "-"}
                                  </Td>
                                );
                              if (c.key === "totalProducts")
                                return (
                                  <Td key={`${u.id}-tprod`}>
                                    {u.totalProducts ??
                                      u.TotalProducts ??
                                      u.productsCount ??
                                      "-"}
                                  </Td>
                                );
                              if (c.key === "totalProductsSold")
                                return (
                                  <Td key={`${u.id}-tsold`}>
                                    {u.totalProductsSold ??
                                      u.TotalProductsSold ??
                                      "-"}
                                  </Td>
                                );
                              if (c.key === "totalMoneySpend")
                                return (
                                  <Td key={`${u.id}-tmoney`}>
                                    {u.totalMoneySpend ??
                                      u.totalMoneySpent ??
                                      u.TotalMoneySpent ??
                                      "-"}
                                  </Td>
                                );
                              if (c.key === "actions") {
                                const isBlockedTab = category === "blocked";
                                const isLockedTab = category === "locked";
                                return (
                                  <Td
                                    key={`${u.id}-actions`}
                                    style={{ textAlign: "right" }}
                                  >
                                    <div className="row-actions">
                                      <button
                                        className="btn btn-view"
                                        onClick={() =>
                                          navigate(
                                            `/dashboard/users/${u.id}/view`
                                          )
                                        }
                                      >
                                        View
                                      </button>
                                      <button
                                        className="btn btn-edit"
                                        onClick={() =>
                                          navigate(
                                            `/dashboard/users/${u.id}/edit`
                                          )
                                        }
                                      >
                                        Edit
                                      </button>
                                      {isBlockedTab ? (
                                        <button
                                          className="btn"
                                          onClick={() =>
                                            confirmAndUnblock(u.id)
                                          }
                                          title="Unblock this user"
                                        >
                                          Unblock
                                        </button>
                                      ) : isLockedTab ? (
                                        <button
                                          className="btn"
                                          onClick={() => confirmAndUnlock(u.id)}
                                          title="Unlock this user"
                                        >
                                          Unlock
                                        </button>
                                      ) : (
                                        <div
                                          className={`dropdown ${
                                            openRowMenuId === u.id ? "open" : ""
                                          }`}
                                          ref={
                                            openRowMenuId === u.id
                                              ? menuRef
                                              : null
                                          }
                                        >
                                          <button
                                            className="btn btn-more"
                                            onClick={() => toggleRowMenu(u.id)}
                                          >
                                            More ▾
                                          </button>
                                          <div className="menu">
                                            <button
                                              className="menu-btn menu-activate"
                                              onClick={() =>
                                                alert("Activate (stub)")
                                              }
                                            >
                                              Activate
                                            </button>
                                            <button
                                              className="menu-btn menu-deactivate"
                                              onClick={() =>
                                                alert("Deactivate (stub)")
                                              }
                                            >
                                              Deactivate
                                            </button>
                                            <button
                                              className="menu-btn menu-block"
                                              onClick={() => handleBlock(u.id)}
                                            >
                                              Block
                                            </button>
                                            <button
                                              className="menu-btn menu-unblock"
                                              onClick={() =>
                                                handleUnblock(u.id)
                                              }
                                            >
                                              Unblock
                                            </button>
                                            <button
                                              className="menu-btn menu-lock"
                                              onClick={() =>
                                                openLockModal(u.id)
                                              }
                                            >
                                              Lock
                                            </button>
                                            <button
                                              className="menu-btn menu-unlock"
                                              onClick={() => handleUnlock(u.id)}
                                            >
                                              Unlock
                                            </button>
                                            <button
                                              className="menu-btn menu-reset"
                                              onClick={() =>
                                                openResetPwModal(u.id)
                                              }
                                            >
                                              Reset password
                                            </button>
                                            <button
                                              className="menu-btn menu-delete"
                                              onClick={() =>
                                                confirmAndDelete(u.id)
                                              }
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </Td>
                                );
                              }
                              return <Td key={`${u.id}-${c.key}`}>-</Td>;
                            })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <div className="pagination-info">
                  Page {page} of {totalPages}
                </div>
                <div className="pagination-controls">
                  <button
                    className="btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages })
                    .slice(0, 7)
                    .map((_, i) => {
                      const n = i + 1;
                      return (
                        <button
                          key={n}
                          className={`btn ${n === page ? "active" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      );
                    })}
                  <button
                    className="btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
              {!tabs.find((t) => t.key === category)?.implemented && (
                <div className="users-card" style={{ marginTop: 12 }}>
                  This section is coming soon.
                </div>
              )}
            </div>

            {showColumnPicker && (
              <div className="users-card" style={{ marginTop: 12 }}>
                <div className="columns-picker">
                  {columns.map((c, idx) => (
                    <label key={c.key}>
                      <input
                        type="checkbox"
                        checked={c.visible}
                        disabled={c.key === "select" || c.key === "actions"}
                        onChange={(e) => {
                          const next = [...columns];
                          next[idx] = {
                            ...next[idx],
                            visible: e.target.checked,
                          };
                          setColumns(next);
                        }}
                      />
                      <span>
                        {c.label || (c.key === "select" ? "Select" : c.key)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />

      <AddEditModal
        open={showAddEdit}
        onClose={closeAddEdit}
        initial={editUser}
      />

      <LockUserModal
        open={lockModal.open}
        userId={lockModal.userId}
        onClose={() => setLockModal({ open: false, userId: null })}
        onSuccess={() => refresh()}
      />
      <ResetPasswordModal
        open={resetPwModal.open}
        userId={resetPwModal.userId}
        onClose={() => setResetPwModal({ open: false, userId: null })}
      />
    </div>
  );
};

const Th = ({ children, onClick, active, dir, style }) => (
  <th
    onClick={onClick}
    style={{
      textAlign: "left",
      padding: "12px 14px",
      fontWeight: 600,
      cursor: onClick ? "pointer" : "default",
      whiteSpace: "nowrap",
      borderBottom: "1px solid #eee",
      ...style,
    }}
  >
    <span>
      {children}
      {onClick && (
        <span style={{ marginLeft: 6, color: active ? "#111" : "#bbb" }}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      )}
    </span>
  </th>
);

const Td = ({ children, style }) => (
  <td style={{ padding: "12px 14px", verticalAlign: "top", ...style }}>
    {children}
  </td>
);

const AddEditModal = ({ open, onClose, initial }) => {
  const [data, setData] = useState(() => ({
    fullName: initial?.fullName || "",
    email: initial?.email || "",
    phoneNumber: initial?.phoneNumber || initial?.phone || "",
    role: initial?.role || "buyer",
    address: initial?.address || "",
    isActive: typeof initial?.isActive === "boolean" ? initial.isActive : true,
  }));
  useEffect(() => {
    setData({
      fullName: initial?.fullName || "",
      email: initial?.email || "",
      phoneNumber: initial?.phoneNumber || initial?.phone || "",
      role: initial?.role || "buyer",
      address: initial?.address || "",
      isActive:
        typeof initial?.isActive === "boolean" ? initial.isActive : true,
    });
  }, [initial]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? "Edit User" : "Add User"}</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Full Name</label>
            <input
              className="input"
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              className="input"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Phone</label>
            <input
              className="input"
              value={data.phoneNumber}
              onChange={(e) =>
                setData({ ...data, phoneNumber: e.target.value })
              }
            />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select
              className="input"
              value={data.role}
              onChange={(e) => setData({ ...data, role: e.target.value })}
            >
              <option value="buyer">Buyer</option>
              <option value="farmer">Farmer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-row">
            <label>Address</label>
            <input
              className="input"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Status</label>
            <select
              className="input"
              value={String(data.isActive)}
              onChange={(e) =>
                setData({ ...data, isActive: e.target.value === "true" })
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              alert("Save (stub) – API will be wired later.");
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default Users;

const LockUserModal = ({ open, onClose, userId, onSuccess }) => {
  const [minutes, setMinutes] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Lock User</h3>
          <button
            className="btn btn-ghost"
            onClick={() => !submitting && onClose()}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Lock duration (minutes)</label>
            <input
              type="number"
              className="input"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <small style={{ color: "#6b7280" }}>
              Note: This value is sent as lockOutEndTime (integer).
            </small>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                const res = await userAPI.lockUser(userId, minutes);
                if (res?.success) {
                  alert("User locked");
                  onSuccess?.();
                  onClose();
                } else {
                  alert(res?.error || "Failed to lock user");
                }
              } catch (e) {
                alert(e?.message || "Failed to lock user");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Locking…" : "Lock"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ResetPasswordModal = ({ open, onClose, userId }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const valid = password.length >= 6 && confirm === password;
  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setShowPw(false);
      setSubmitting(false);
      setError("");
    }
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Reset Password</h3>
          <button
            className="btn btn-ghost"
            onClick={() => !submitting && onClose()}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>New password</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type={showPw ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn"
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="form-row">
            <label>Confirm password</label>
            <input
              type={showPw ? "text" : "password"}
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {!valid && (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>
              Passwords must match and be at least 6 characters.
            </div>
          )}
          {!!error && (
            <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                const res = await userAPI.resetPasswordByAdmin(
                  userId,
                  password,
                  confirm
                );
                if (res?.success) {
                  alert("Password reset successfully");
                  onClose();
                } else {
                  const msg = res?.error || "Failed to reset password";
                  setError(msg);
                }
              } catch (e) {
                setError(e?.message || "Failed to reset password");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Resetting…" : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
};
