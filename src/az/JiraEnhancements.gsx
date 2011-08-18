package az

enhancement JiraEnhancements : gw.RemoteIssue { 
  
  function isOpen() :boolean {
//    print ("In the isOpen enhancement: Status is ${this.Status}")
    if (JiraStatuses.getValueByName(this.Status) == "Open") {
//      print ("isOpen returning True")
      return true
    }
    return false
  }
  
  function isClosed() : boolean {
//    print("In the isClosed enhancement: Status is ${this.Status}")  
    var status = JiraStatuses.getValueByName( this.Status )
    if (status == "Closed"){
      var QAstat = getJiraQAStatus()
//      print ("Jira not in Dev: QAStat: ${QAstat}")
      if (JiraQAStatusMapping.getValueByName( QAstat) == "Passed" ||
          JiraQAStatusMapping.getValueByName( QAstat) == "Unneeded" ||
          JiraQAStatusMapping.getValueByName( QAstat) == "Wont_Fix") {
//            print ("Jira doesn't need QA")
//              print ("isClosed returning True")
              return true 
          }
    }      
    return false
  }
  
  function isCheckedInAndQANotNeeded() : boolean {
    var status = JiraStatuses.getValueByName( this.Status )
//    print("In the isCheckedInAndQANotNeeded  enhancement: ${status}")  
    
    if (status == "Checked In" ||
        status == "In Stable" ||
        status == "Staged"){
      var QAstat = getJiraQAStatus()
//      print ("Jira not in Dev: QAStat: ${QAstat}")
      if (JiraQAStatusMapping.getValueByName( QAstat) == "Passed" ||
          JiraQAStatusMapping.getValueByName( QAstat) == "Unneeded") {
//            print ("Jira doesn't need QA")
             return true
          }
    }
//    print ("Jira needs QA")
    return false  
  }
  
  function isCheckedInAndReadyForQA() : boolean  {
    var status = JiraStatuses.getValueByName( this.Status )
//    print("In the isCheckedInAndReadyForQA enhancement: ${status}, ")  
    
    if (status == "Checked In" ||
        status == "In Stable" ||
        status == "Staged" ||
        status == "Closed"){
      var QAstat = getJiraQAStatus()
//     print ("Jira not in Dev but QA: ${QAstat}")
      if (QAstat == JiraQAStatusMapping.getValueByName( "Ready_for_QA")) {
//      print ("Ready for QA too")
        return true
      }
    }
    
    return false  
  }
  
  function failedQA() : boolean {
    var QAstat = getJiraQAStatus()
//    print("In the failedQA enhancement: ${QAstat}")  
    
    if (QAstat == JiraQAStatusMapping.getValueByName( "Failed")) {
      return true  
    }
    
    return false  
  }
  
  
  
  
  function getJiraEstimate() : String {    
    return this.CustomFieldValues.firstWhere( \ r -> r.CustomfieldId == "customfield_10321" )?.Values?[0]
  }

  private function getJiraQAStatus() : String {  
    var qastat = this.CustomFieldValues.firstWhere( \ r -> r.CustomfieldId == "customfield_10480" )?.Values?[0]
//    print ("qastat is: ${qastat}")
    if (qastat == null) {
      return "000"
    }    
    var qastate = qastat.replace( " ", "_" )
//    print ("qastate is: ${qastate}")
   return JiraQAStatusMapping.getValueByName(qastate)
  }  

  
}
