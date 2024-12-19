// Authorization Mixin Module
// =======================

/** Staff authorization mixin
 *  @param {Object} aObj - Target object for method injection
 *  @returns {Object} Enhanced object with staff authorization methods
 */
export function Staff(aObj) {
  /** Validates general staff access level
   *  @returns {boolean} True if staff privileges exist
   */
  aObj.CkStaff = function () {
    return this.CdStaff !== "NotStaff";
  };

  /** Validates accounting staff access level
   *  @returns {boolean} True if accounting privileges exist
   */
  aObj.CkStaffAccts = function () {
    return (
      this.CdStaff === "StaffAccts" || this.CdStaff === "StaffMgr" || this.CdStaff === "StaffSuper"
    );
  };

  /** Validates manager access level
   *  @returns {boolean} True if manager privileges exist
   */
  aObj.CkStaffMgr = function () {
    return this.CdStaff === "StaffMgr" || this.CdStaff === "StaffSuper";
  };

  /** Validates superuser access level
   *  @returns {boolean} True if superuser privileges exist
   */
  aObj.CkStaffSuper = function () {
    return this.CdStaff === "StaffSuper";
  };

  return aObj;
}
