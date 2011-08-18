package az
uses xsds.agilezenstories.Story
uses gw.RemoteIssue
uses java.util.HashMap
uses java.math.BigInteger
uses org.apache.commons.httpclient.methods.PutMethod

enhancement AZStoryEnhancements : xsds.agilezenstories.Story {
 
 
 /*
 * returns true if the Story is in a Phase that Jira should consider "Open"
 */ 
 function isOpen() : boolean {
   var phaseStr = AZPhases.getValueByName(this.Phase.Id as String)
//   print ("In AZStoryEnhancement.isOpen with ${this.Phase} as ${phaseStr}")
   if (phaseStr == "Backlog"
    || phaseStr == "Ready"
    || phaseStr == "In_Dev"){
//     print ("Returning True for isOpen: ${phaseStr}")
        return true 
   }
   return false 
 }
 
  /*
 * returns true if the Story is in a Phase that Jira should consider "In QA"
 */ 
 function isInQA() : boolean {
   var phaseStr = AZPhases.getValueByName(this.Phase.Id as String)
//   print ("In AZStoryEnhancement.isInQA with ${this.Phase.Id} as ${phaseStr}")
   if (phaseStr == "QA" || phaseStr == "Ready_for_QA"){
//     print ("Returning True for isInQA: ${phaseStr}")
        return true 
   }
   return false 
 }
 
  
  function reopen() {
    this.Phase.Id = new BigInteger(AZPhases.getValueByName( "Ready" ))
//    print ("Re-opening: setting Phase to: ${this.Phase.Id}")
    var reopenTag = new xsds.agilezenstories.types.complex.IdNamePair()
    reopenTag.Name = "reopened"
    reopenTag.Id = 138151
    this.Tags.Tag.add( new xsds.agilezenstories.anonymous.elements.Story_Tags_Tag(reopenTag) )
//    this.print()
  }
  
  function close() {
    print("Closing on board")
    var foo = new BigInteger(AZPhases.getValueByName( "Closed" ))
//    print ("Closing with : ${foo}")
    this.Phase.Id = new BigInteger(AZPhases.getValueByName( "Closed" ))
    this.Phase.Name= "Closed"
//    this.print()
  }
  
  function setReadyForQA() {
//    print("Moving to QA")
    this.Phase.Id = new BigInteger(AZPhases.getValueByName( "Ready_for_QA" ))
    setReadyToPull()
  }

  function setReadyToPull(){
    this.Status_elem.$Text = "ready"
  }

}