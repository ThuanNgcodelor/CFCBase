/**
 * Service Xuất Hợp Đồng Thử Việc khớp 100% 22 biến placeholder của Backend Java
 * Template source: backend/src/main/resources/hr/templates/probation-contract-template.docx
 */
const ContractService = {

  // Chuyển số tiền thành chữ Tiếng Việt
  numberToVietnameseText: function(num) {
    if (!num || isNaN(num)) return 'Không đồng';
    const n = Math.round(Number(num));
    if (n === 0) return 'Không đồng';
    
    // Tạm thời format chuẩn số tiền kèm đơn vị đồng
    return n.toLocaleString('vi-VN') + ' đồng';
  },

  generateProbationContract: function(data, templateDocId, targetFolderId) {
    try {
      if (!templateDocId || templateDocId.includes('DIEN_DOCS')) {
        return { 
          success: false, 
          message: 'Vui lòng nhập ID file Google Docs mẫu Hợp đồng thử việc!' 
        };
      }

      const folder = targetFolderId ? DriveApp.getFolderById(targetFolderId) : DriveApp.getRootFolder();
      const templateFile = DriveApp.getFileById(templateDocId);
      
      const now = new Date();
      const contractYear = now.getFullYear();
      const contractNo = data.contractNo || `HĐTV-${now.getTime().toString().slice(-6)}/${contractYear}`;

      // 1. Tạo bản sao từ file Docs mẫu
      const fileName = `HĐTV_${data.fullName}_${data.citizenId || 'Moi'}`;
      const newDocFile = templateFile.makeCopy(fileName, folder);
      const doc = DocumentApp.openById(newDocFile.getId());
      const body = doc.getBody();

      // 2. Map 100% khớp 22 biến Placeholder của Java Backend (probation-contract-template.docx)
      const replacements = {
        '{{CONTRACT_NO}}': contractNo,
        '{{CONTRACT_YEAR}}': String(contractYear),
        '{{SIGN_DAY}}': String(now.getDate()).padStart(2, '0'),
        '{{SIGN_MONTH}}': String(now.getMonth() + 1).padStart(2, '0'),
        '{{SIGN_YEAR}}': String(contractYear),
        '{{CANDIDATE_TITLE}}': data.candidateTitle || (data.gender === 'Nữ' ? 'Bà' : 'Ông'),
        '{{FULL_NAME}}': (data.fullName || '').toUpperCase(),
        '{{NATIONALITY}}': data.nationality || 'Việt Nam',
        '{{DATE_OF_BIRTH}}': data.dateOfBirth || '',
        '{{BIRTH_PLACE}}': data.birthPlace || 'TP. Hồ Chí Minh',
        '{{PERMANENT_ADDRESS}}': data.permanentAddress || '',
        '{{CITIZEN_ID}}': data.citizenId || '',
        '{{CITIZEN_ID_ISSUED_DATE}}': data.citizenIdIssuedDate || '',
        '{{CITIZEN_ID_ISSUED_PLACE}}': data.citizenIdIssuedPlace || 'Cục Cảnh sát QLHC về trật tự xã hội',
        '{{PROBATION_CONTRACT_TYPE}}': data.probationContractType || 'Xác định thời hạn 02 tháng',
        '{{PROBATION_START_DATE}}': data.probationStartDate || '',
        '{{PROBATION_END_DATE}}': data.probationEndDate || '',
        '{{POSITION_NAME}}': data.positionName || 'Nhân viên thử việc',
        '{{JOB_DESCRIPTION}}': data.jobDescription || 'Thực hiện công việc theo sự phân công của Trưởng đơn vị.',
        '{{BASE_SALARY_TEXT}}': this.numberToVietnameseText(data.baseSalary),
        '{{SALARY_NOTE}}': data.salaryNote || 'Lương thử việc bằng 85% lương chính thức.',
        '{{DEPARTMENT_RULE_NOTE}}': data.departmentRuleNote || 'Tuân thủ nội quy lao động và quy định của Xí nghiệp.'
      };

      // Thực hiện thay thế biến
      for (let key in replacements) {
        body.replaceText(key, replacements[key] || '');
      }

      doc.saveAndClose();

      // 3. Xuất ra file PDF
      const pdfBlob = newDocFile.getAs(MimeType.PDF);
      const pdfFile = folder.createFile(pdfBlob).setName(fileName + '.pdf');

      // Phân quyền công khai xem link
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      newDocFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return {
        success: true,
        pdfUrl: pdfFile.getUrl(),
        docUrl: newDocFile.getUrl(),
        message: `Đã tạo Hợp đồng thử việc số ${contractNo} thành công!`
      };
    } catch (err) {
      Logger.log('Lỗi generateProbationContract: ' + err.toString());
      return {
        success: false,
        message: 'Lỗi xuất hợp đồng: ' + err.message
      };
    }
  }
};
